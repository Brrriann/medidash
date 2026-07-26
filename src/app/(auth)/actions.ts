"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMockMode } from "@/lib/supabase/env";

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

export async function signOutAction() {
  if (!isMockMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
