/**
 * 목록 위에 놓이는 거름망 단추.
 *
 * 종전에는 화면마다 제각각이었다 — 소싱은 둥근 알약에 브랜드색, 편성은 사각에 검정.
 * 같은 일을 하는 단추가 화면마다 다르게 생기면 셀러는 매번 다시 배운다.
 *
 * 모양은 알약이 아니라 각진 사각이다. 이 화면들이 다루는 건 목록과 수치라,
 * 둥근 알약보다 칸에 맞는 사각이 표·괘선과 같이 놓였을 때 어긋나지 않는다.
 */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      /* py-3 = 44px. 주 사용자가 50~60대라 표적이 작으면 빗나간다 */
      className={`whitespace-nowrap rounded-md border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
