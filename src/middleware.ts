import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** 로그인 없이 접근 가능한 경로 */
const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase 미설정 — 개발에서만 mock 모드로 통과시킨다.
  // 프로덕션에서 통과시키면 인증이 통째로 사라지므로 여기서 막는다 (src/lib/supabase/env.ts 참고).
  if (!url || !anon) {
    if (process.env.NODE_ENV === "production")
      return new NextResponse("서버 설정 오류 — 관리자에게 문의하세요.", { status: 503 });
    return NextResponse.next(); // 개발/시연 전용 mock 모드
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // 세션 갱신 겸 사용자 확인 (getUser는 매 요청 토큰 검증)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  /**
   * 미들웨어 제외 대상.
   *
   * `_next/static`만 빼고 `public/` 자산(예: /models/body.glb 7.6MB)이 빠져 있었다.
   * 그래서 정적 파일 요청 하나마다 이 미들웨어가 돌며 Supabase `auth.getUser()`를
   * 네트워크로 호출했고, 비로그인 사용자는 모델 요청이 /login으로 307 리다이렉트됐다.
   * 게다가 미들웨어를 타면 `_next/static`이 받는 `immutable` 장기 캐시도 못 받는다.
   *
   * `public/` 파일은 Next에서 원래 누구나 받을 수 있는 공개 자산이라 미들웨어로 막아봐야
   * 보호가 되지도 않는다 — 확장자로 통째로 제외한다.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:glb|gltf|bin|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
