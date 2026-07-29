import type { ReactNode } from "react";

export interface Stat {
  label: string;
  value: ReactNode;
  /** 값 아래 덧붙일 짧은 보조 문구 (단위·기준 등) */
  hint?: string;
}

/**
 * 작은 회색 라벨 + 큰 굵은 값 타일 행.
 *
 * 지표를 문장 안에 섞어 쓰면 눈에 안 들어와서, 숫자는 전부 이 타일로 뽑는다.
 * 항목 수는 2~4개를 전제로 한다 — 그 이상은 타일이 좁아져 읽히지 않는다.
 */
export function StatTiles({ items }: { items: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-400">
            {s.label}
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {s.value}
          </p>
          {s.hint && <p className="mt-0.5 text-[11px] text-slate-400">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}
