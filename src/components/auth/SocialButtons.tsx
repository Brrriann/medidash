import { signInWithProviderAction } from "@/app/(auth)/actions";

/**
 * 소셜 로그인 버튼.
 *
 * 각 제공자의 브랜드 색·표기 규정을 따른다 — 카카오는 노란 배경에 검정 글자,
 * 구글은 흰 배경에 컬러 로고가 각 가이드라인의 요구사항이다.
 *
 * 서버 액션 form이라 자바스크립트 없이도 동작한다.
 */
const BUTTONS = [
  {
    provider: "kakao",
    label: "카카오로 계속하기",
    className: "bg-[#FEE500] text-[#191600] hover:brightness-95",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 .2.1.3.3.2.2-.1 2.7-1.8 3.7-2.5.6.1 1.2.1 1.7.1 5.1 0 9.2-3.3 9.2-7.3S17.1 3 12 3Z"
        />
      </svg>
    ),
  },
  {
    provider: "google",
    label: "Google로 계속하기",
    className: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    icon: (
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5Z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.6-.15-3.15-.4-4.65H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.6 5.9c4.44-4.1 7.22-10.16 7.22-17.45Z" />
        <path fill="#FBBC05" d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z" />
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2.05 15.2-5.55l-7.6-5.9c-2.05 1.4-4.7 2.25-7.6 2.25-6.3 0-11.7-3.8-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48Z" />
      </svg>
    ),
  },
] as const;

export function SocialButtons() {
  return (
    <div className="space-y-2">
      {BUTTONS.map((b) => (
        <form key={b.provider} action={signInWithProviderAction}>
          <input type="hidden" name="provider" value={b.provider} />
          <button
            type="submit"
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${b.className}`}
          >
            {b.icon}
            {b.label}
          </button>
        </form>
      ))}
    </div>
  );
}

/** 소셜 버튼과 이메일 폼 사이의 구분선 */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs text-slate-600">또는 이메일로</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
