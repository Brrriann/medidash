import Link from "next/link";
import type { BroadcastStat } from "@/lib/data";
import { channelName, upcomingRows } from "@/lib/broadcast";

/**
 * 홈쇼핑 방송 트렌드 (docs/SPEC.md §6.3)
 *
 * "지금 홈쇼핑에서 뭐가 도나"를 셀러가 소싱 전에 보게 한다.
 * **브랜드 지표 대신 이걸 만든 이유**: 도매몰 상위 브랜드 20개로 실측했더니 홈쇼핑에
 * 잡히는 건 4개뿐이라(배지가 붙을 상품 8.1%) 브랜드 배지는 92%가 빈칸이 된다.
 * 반면 원료 단위 방송 활동은 카탈로그와 무관하게 항상 값이 있다.
 *
 * 방송 예정(upcoming)을 앞에 둔다 — 이미 나간 방송보다 앞으로 나갈 방송이 쓸모 있다.
 * 지금 소싱하면 수요가 오르는 구간에 올라탈 수 있기 때문이다.
 */

function when(at: string): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}


export function BroadcastTrend({
  broadcast,
  now,
}: {
  broadcast: Record<string, BroadcastStat>;
  /** 서버에서 넘긴 기준 시각 — 클라이언트 시계와 어긋나 hydration이 깨지지 않게 */
  now: number;
}) {
  const entries = Object.entries(broadcast);
  if (entries.length === 0) return null;

  // 방송이 도는 원료.
  // **순위를 매기지 않는다.** hsmoa가 상위 10건만 주므로 과거 방송수는 87종 중 49종이,
  // 예정 방송수는 21종이 나란히 10에 걸린다 — 이 데이터로는 "누가 더 많이 방송되나"를
  // 말할 수 없다. 그래서 "활발한 원료 집합"으로만 보여주고, 정렬은 예정 방송이 있는 것
  // 우선(앞으로의 신호가 더 쓸모 있다) → 이름순으로 고정해 렌더가 흔들리지 않게 한다.
  const hot = entries
    .filter(([, s]) => s.count > 0)
    .sort(
      (a, b) =>
        b[1].upcoming.length - a[1].upcoming.length || a[0].localeCompare(b[0]),
    )
    .slice(0, 10);

  // 예정 방송은 전용 화면(/broadcast)과 같은 규칙으로 펼친다 — 중복 제거·준비 기간 긴 순.
  // 여기는 맛보기라 6건만 두고, 나머지는 전체 보기로 넘긴다.
  const all = upcomingRows(broadcast, now);
  const upcoming = all.slice(0, 6);

  if (!hot.length && !upcoming.length) return null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">📺 홈쇼핑 방송 트렌드</h2>
        {/* 갱신 주기가 아니라 **데이터가 덮는 창**을 적는다 — 셀러의 판단을 바꾸는 건
            "얼마나 자주 긁는가"가 아니라 "얼마나 앞을 볼 수 있는가"다. */}
        <Link
          href="/broadcast"
          className="text-[11px] font-medium text-slate-400 transition hover:text-brand-700"
        >
          홈쇼핑모아 · 편성표 열흘치 · 전체 {all.length}건 →
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {hot.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] text-slate-500">
              방송이 활발한 원료 —{" "}
              <span className="text-slate-400">클릭하면 그 원료로 소싱합니다</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hot.map(([name, s]) => (
                <Link
                  key={name}
                  href={`/sourcing?q=${encodeURIComponent(name)}`}
                  title={s.titles.slice(0, 5).join("\n")}
                  className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                >
                  {name}
                  {s.upcoming.length > 0 && (
                    <span className="ml-1 text-[10px] text-rose-500/70">
                      예정 {s.upcoming.length}
                      {s.upcoming.length >= 10 ? "+" : ""}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] text-slate-500">
              방송 예정 · 준비 기간 긴 순 —{" "}
              <span className="text-slate-400">지금 소싱하면 수요 상승기에 맞출 수 있습니다</span>
            </p>
            <ul className="space-y-1.5">
              {upcoming.map((u, i) => (
                <li key={`${u.ingredient}-${i}`} className="flex items-baseline gap-2 text-xs">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${u.lead.tone}`}
                  >
                    {u.lead.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-400">{when(u.at)}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {channelName(u.channel)}
                  </span>
                  <span className="truncate text-slate-700" title={u.name}>
                    {u.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        홈쇼핑모아가 원료당 상위 10건만 제공해 방송 횟수의 정확한 순위는 알 수 없습니다.
        위 목록은 &ldquo;방송이 도는 원료&rdquo;와 &ldquo;확정된 예정 방송&rdquo;만 보여줍니다.
        편성표는 열흘치까지만 공개되므로 그보다 먼 방송은 아직 잡히지 않습니다.
      </p>
    </section>
  );
}
