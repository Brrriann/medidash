import type { ReactNode } from "react";

export interface Stat {
  label: string;
  value: ReactNode;
  /** 값 아래 덧붙일 짧은 보조 문구 (단위·기준 등) */
  hint?: string;
}

/**
 * 수치 한 줄 — 괘선으로 칸을 가른 원장 행.
 *
 * 지표를 문장 안에 섞어 쓰면 눈에 안 들어와서, 숫자는 전부 이 행으로 뽑는다.
 * 항목 수는 2~4개를 전제로 한다 — 그 이상은 칸이 좁아져 읽히지 않는다.
 *
 * 종전에는 회색 타일 네 개를 띄워 뒀는데, 칸마다 배경이 있으면 숫자보다 상자가 먼저 보인다.
 * 지금은 흰 바탕에 괘선만 긋고 숫자에 `tabular-nums`를 줘서 자릿수가 세로로 맞는다 —
 * 6,003과 82를 나란히 놓았을 때 자리가 어긋나지 않는다.
 */
export function StatTiles({ items }: { items: Stat[] }) {
  return (
    <div className="ruled-grid grid grid-cols-2 md:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="bg-white px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
            {s.value}
          </p>
          {s.hint && <p className="mt-0.5 text-[11px] text-slate-400">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}
