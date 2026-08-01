"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMockMode } from "@/lib/supabase/env";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/auth";

export interface AuthState {
  error: string | null;
}

const MOCK_ERROR =
  "Supabase가 설정되지 않은 mock 모드입니다. 로그인 없이 대시보드를 둘러볼 수 있습니다.";

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (isMockMode()) return { error: MOCK_ERROR };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };

  redirect("/");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (isMockMode()) return { error: MOCK_ERROR };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!email || !password || !code)
    return { error: "이메일·비밀번호·수강생 코드를 모두 입력하세요." };
  if (password.length < 8)
    return { error: "비밀번호는 8자 이상이어야 합니다." };

  // 수강생 코드 검증 → 회원 생성 → 프로필 → 코드 사용 처리 (service role — RLS 우회)
  const admin = createAdminClient();

  // 코드를 **먼저** 잡는다(잔여 확인 + 차감이 DB 함수 안에서 한 번에 일어남).
  // 종전엔 조회 후 애플리케이션에서 +1 해 덮어써서, 동시 가입 시 정원 초과가 뚫렸다.
  // 계정을 만든 뒤에 차감하면 그 사이에 정원이 넘을 수 있으므로 순서도 뒤집었다.
  const { data: claimed, error: claimErr } = await admin.rpc("claim_invite_code", {
    p_code: code,
  });
  if (claimErr || claimed !== true)
    return { error: "유효하지 않은 수강생 코드입니다. 운영자에게 문의하세요." };

  /** 이후 단계가 실패하면 잡아둔 코드를 되돌린다 (안 되돌리면 정원이 조용히 줄어든다). */
  const release = async () => {
    await admin.rpc("release_invite_code", { p_code: code });
  };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    await release();
    const already = createErr?.message?.includes("already");
    return {
      error: already
        ? "이미 가입된 이메일입니다. 로그인해 주세요."
        : `가입에 실패했습니다: ${createErr?.message ?? "알 수 없는 오류"}`,
    };
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    role: "member",
    invite_code: code,
  });
  if (profileErr) {
    // 프로필 생성 실패 시 고아 계정 방지
    await admin.auth.admin.deleteUser(created.user.id);
    await release();
    return { error: `가입에 실패했습니다: ${profileErr.message}` };
  }

  // 가입 직후 자동 로그인
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) redirect("/login");

  redirect("/");
}

/**
 * 로그인 화면으로 오류 메시지와 함께 되돌려 보낸다.
 *
 * **반드시 인코딩해야 한다.** Next는 서버 액션의 리다이렉트 대상을 `x-action-redirect`
 * HTTP 헤더에 싣는데 헤더 값에는 비ASCII를 못 넣는다. 한글을 그대로 넣었더니
 * `ERR_INVALID_CHAR`로 500이 났다 — 로그인 화면이 아니라 오류 화면이 뜬다.
 */
function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

/**
 * 소셜 로그인 시작 — 제공자 동의 화면으로 보낸다.
 *
 * **수강생 코드 관문은 여기서 안 본다.** 소셜 계정은 이 시점에 아직 존재하지 않아
 * 코드를 물어볼 대상이 없다. 로그인이 끝나 사용자 id가 생긴 뒤 `/onboarding`에서 받는다.
 * 대시보드 진입 차단은 프로필 유무로 하므로(=코드를 낸 사람만 프로필이 있다) 관문은 유지된다.
 */
export async function signInWithProviderAction(formData: FormData): Promise<void> {
  if (isMockMode()) loginError("mock 모드에서는 소셜 로그인을 쓸 수 없습니다.");

  const provider = String(formData.get("provider") ?? "");
  if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) {
    loginError("지원하지 않는 로그인 방식입니다.");
  }

  // 콜백 주소는 요청 호스트에서 만든다 — 로컬·프리뷰·프로덕션이 각자 자기 주소로 돌아와야 한다.
  // (Supabase 대시보드 Redirect URLs에 각 주소를 등록해 둬야 실제로 허용된다.)
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as SocialProvider,
    options: { redirectTo: `${proto}://${host}/auth/callback` },
  });
  if (error || !data.url) {
    loginError(error?.message ?? "로그인을 시작하지 못했습니다.");
  }

  redirect(data.url);
}

/**
 * 소셜로 들어온 사용자에게 수강생 코드를 받아 프로필을 만든다 (= 대시보드 입장권).
 *
 * 코드를 먼저 잡고 프로필을 넣는 순서는 signUpAction과 같다. 동시 제출로 코드가 두 번
 * 차감되는 건 `profiles.id`(=user.id)가 기본키라 두 번째 insert가 실패하면서 막힌다 —
 * 실패분은 아래에서 코드를 되돌린다. 위의 사전 조회는 빠른 길일 뿐 진짜 방어선이 아니다.
 */
export async function claimCodeAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (isMockMode()) return { error: MOCK_ERROR };

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "수강생 코드를 입력하세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) redirect("/");

  const { data: claimed, error: claimErr } = await admin.rpc("claim_invite_code", {
    p_code: code,
  });
  if (claimErr || claimed !== true)
    return { error: "유효하지 않은 수강생 코드입니다. 운영자에게 문의하세요." };

  const { error: profileErr } = await admin.from("profiles").insert({
    id: user.id,
    email: user.email,
    role: "member",
    invite_code: code,
  });
  if (profileErr) {
    await admin.rpc("release_invite_code", { p_code: code });
    return { error: "가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/");
}

export async function signOutAction() {
  if (!isMockMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
