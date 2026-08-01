import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

/**
 * 소셜 로그인 콜백 — 제공자가 돌려준 인가 코드를 세션으로 바꾼다.
 *
 * `signInWithOAuth`가 심어둔 PKCE verifier 쿠키와 이 code를 맞바꿔야 세션 쿠키가 선다.
 * 이 경로는 **세션이 아직 없는 상태로 들어온다** — 미들웨어에서 반드시 통과시켜야 한다.
 *
 * `next`(로그인 전에 가려던 경로)는 `safeNext`로 내부 경로만 통과시킨다 — 오픈 리다이렉트 차단.
 */

/** 오류 메시지는 반드시 인코딩한다 — 한글을 그대로 넣으면 Location 헤더가 깨진다. */
function toLogin(origin: string, message: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, origin),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // 사용자가 제공자 동의 화면에서 취소하면 code 없이 error만 돌아온다.
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (oauthError) return toLogin(url.origin, oauthError);
  if (!code) return toLogin(url.origin, "인가 코드가 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toLogin(url.origin, error.message);

  // 프로필(=수강생 코드 확인)이 있는지는 대시보드 레이아웃이 검사해 /onboarding으로 보낸다.
  // 여기서 또 조회하면 같은 판정을 두 곳에서 하게 돼 한쪽만 고치는 실수가 난다.
  return NextResponse.redirect(new URL(next, url.origin));
}
