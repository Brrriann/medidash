"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { channelName, type UpcomingRow } from "@/lib/broadcast";
import { FilterChip } from "@/components/ui/FilterChip";

/**
 * 홈쇼핑 편성 목록.
 *
 * 종전에는 홈 위젯에 예정 6건만 얹혀 있었다. 실측하면 예정 방송이 190건(중복 제거)이라
 * 수집한 것의 3%만 보이던 셈이다. 이 화면이 나머지를 받는다.
 *
 * **거르는 축을 "여유"로 잡은 이유**: 편성표가 열흘치뿐이고 그중 절반 이상이 오늘치다.
 * 셀러가 이 화면에서 하는 판단은 "무엇을 볼까"가 아니라 "지금 준비해서 댈 수 있나"라서,
 * 남은 시간이 첫 번째 거름망이 된다.
 */

const PAGE_STEP = 40;

/** 여유 구간 — leadTime의 5일/2일 경계와 같은 값을 쓴다. */
const BANDS = [
  { key: "all", label: "전체", test: () => true },
  { key: "wide", label: "5일 이상", test: (d: number) => d >= 5 },
  { key: "mid", label: "2~5일", test: (d: number) => d >= 2 && d < 5 },
  { key: "near", label: "임박", test: (d: number) => d < 2 },
] as const;

function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BroadcastSchedule({ rows }: { rows: UpcomingRow[] }) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<string | null>(null);
  const [band, setBand] = useState<(typeof BANDS)[number]["key"]>("all");
  const [shown, setShown] = useState(PAGE_STEP);

  // 실제로 예정 방송이 있는 채널만, 건수 많은 순으로
  const channels = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.channel, (n.get(r.channel) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = BANDS.find((b) => b.key === band)!.test;
    return rows.filter((r) => {
      if (channel && r.channel !== channel) return false;
      if (!test(r.lead.days)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || r.ingredient.toLowerCase().includes(q)
      );
    });
  }, [rows, query, channel, band]);

  useEffect(() => setShown(PAGE_STEP), [query, channel, band]);
  const visible = filtered.slice(0, shown);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명 또는 원료 검색"
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <select
          value={channel ?? ""}
          onChange={(e) => setChannel(e.target.value || null)}
          aria-label="채널"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">전체 채널</option>
          {channels.map(([code, n]) => (
            <option key={code} value={code}>
              {channelName(code)} ({n})
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {BANDS.map((b) => (
            <FilterChip
              key={b.key}
              active={band === b.key}
              onClick={() => setBand(b.key)}
            >
              {b.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">조건에 맞는 편성이 없습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            채널이나 여유 구간을 바꿔 보세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            총{" "}
            <span className="font-semibold tabular-nums text-slate-700">
              {filtered.length.toLocaleString("ko-KR")}
            </span>
            건
            {filtered.length > visible.length &&
              ` 중 ${visible.length.toLocaleString("ko-KR")}건 표시`}
          </p>

          {/* 표가 좁은 화면에서 잘리지 않게 제 컨테이너 안에서만 가로로 흐르게 한다 */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">여유</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">방송 일시</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">채널</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">상품명</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">잡힌 원료</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr
                    key={`${r.name}|${r.at}|${i}`}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${r.lead.tone}`}
                      >
                        {r.lead.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-500">
                      {when(r.at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                      {channelName(r.channel)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">{r.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link
                        href={`/sourcing?q=${encodeURIComponent(r.ingredient)}`}
                        className="rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
                      >
                        {r.ingredient} 소싱 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > visible.length && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_STEP)}
                className="rounded-md border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
              >
                더 보기 ({(filtered.length - visible.length).toLocaleString("ko-KR")}건 남음)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
