import Link from "next/link";

/** Supabase 미설정(mock 모드) 안내 — 로그인 없이 둘러보기 링크 제공 */
export function MockNotice() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
      <strong>Mock 모드</strong> — Supabase가 설정되지 않아 로그인 기능이
      비활성화되어 있습니다.{" "}
      <Link href="/" className="font-semibold underline underline-offset-2">
        로그인 없이 둘러보기 →
      </Link>
    </div>
  );
}
