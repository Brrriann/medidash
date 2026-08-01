/**
 * 인증 화면이 공유하는 순수 값·함수.
 *
 * 서버 액션 파일(`"use server"`)은 async 함수만 export할 수 있어서 상수를 둘 수 없고,
 * 라우트 핸들러 파일도 핸들러 외의 export를 두면 곤란하다. 그래서 양쪽이 쓰는 건 여기 모은다.
 * (테스트가 React·Next 없이 부를 수 있다는 이점도 있다.)
 */

/**
 * 소셜 로그인 제공자 — **Supabase 대시보드에서 켠 것만 여기 둔다.**
 * 안 켠 제공자를 넣으면 버튼은 보이는데 누르면 Supabase 오류 화면으로 떨어진다.
 *
 * 네이버는 Supabase 기본 제공자가 아니라 Custom OAuth2로 붙여야 하고 식별자가
 * `custom:naver`가 된다. 네이버 userinfo 응답이 `{response:{id,email}}`처럼 한 겹
 * 감싸여 있는데 Custom OAuth2에는 중첩 필드 매핑이 없어 동작이 확인되지 않았다 —
 * 실제로 붙여 확인한 뒤에 추가한다 (docs/DEPLOY.md 소셜 로그인 절).
 */
export const SOCIAL_PROVIDERS = ["google", "kakao"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * 로그인 후 돌아갈 경로 — **내부 경로만 통과시킨다(오픈 리다이렉트 차단).**
 *
 * `/`로 시작하는지만 보면 부족하다: `//evil.com`은 브라우저가 프로토콜 상대 URL로 읽어
 * 외부로 나간다. `/\evil.com`도 일부 브라우저가 `//`처럼 다룬다. 둘 다 막는다.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
