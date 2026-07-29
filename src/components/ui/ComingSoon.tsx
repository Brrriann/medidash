/** 후속 마일스톤 화면 플레이스홀더 — 구현 예정 내용을 사양 기준으로 안내 */
export function ComingSoon({
  title,
  week,
  description,
  features,
  context,
}: {
  title: string;
  week: string;
  description: string;
  features: string[];
  context?: string | null;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8">
        <span className="rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-700">
          {week} 구현 예정
        </span>
        <h1 className="mt-3 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>

        {context && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            {context}
          </div>
        )}

        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          {features.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
