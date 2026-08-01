"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  BodyCategory,
  BodySubcategory,
  SubcategoryDetail,
} from "@/lib/taxonomy/types";
import type { BroadcastStat } from "@/lib/data";
import { channelName, leadTime } from "@/lib/broadcast";
import { COMPLIANCE_NOTICE, DETAIL_TABS, type DetailTabKey } from "@/lib/constants";

/**
 * 부위 상세 패널 (docs/SPEC.md §5-3 — 7종)
 * ①특징 ②추천원료 ③기전원리 ④셀링포인트를 4-Tab으로, ⑤증상은 헤더의 #키워드,
 * ⑥홈쇼핑모아 방송 지표는 탭 아래 띠, ⑦소싱 CTA는 하단.
 */
export function DetailPanel({
  category,
  subcategory,
  symptom,
  detail,
  broadcast,
  now,
  onClose,
}: {
  category: BodyCategory;
  subcategory: BodySubcategory;
  symptom: string;
  detail: SubcategoryDetail | undefined;
  broadcast: Record<string, BroadcastStat>;
  now: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTabKey>("feature");

  // 선택 증상에 매핑된 원료를 앞으로 정렬
  const ingredients = [...(detail?.ingredients ?? [])].sort((a, b) => {
    const am = a.symptoms.includes(symptom) ? 0 : 1;
    const bm = b.symptoms.includes(symptom) ? 0 : 1;
    return am - bm;
  });
  const matchedNames = ingredients
    .filter((i) => i.symptoms.includes(symptom))
    .map((i) => i.name);
  const sourcingQuery = matchedNames.slice(0, 3).join(",");
  const firstIngredient = matchedNames[0] ?? ingredients[0]?.name ?? "";

  return (
    <section
      aria-label={`${subcategory.name} 상세 패널`}
      className="card"
    >
      {/* 헤더 */}
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 pb-3 pt-4">
        <div>
          <p className="text-xs text-slate-600">
            {category.name} · {subcategory.name}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">
            #{symptom}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {detail?.source === "mock" && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              개발용 샘플
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="패널 닫기"
            className="rounded-lg p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* 탭 */}
      <nav className="flex gap-1 px-5 pt-3" role="tablist" aria-label="상세 정보 탭">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.key
                ? "bg-brand-600 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 내용 */}
      <div className="min-h-[180px] px-5 py-4 text-sm leading-relaxed text-slate-700">
        {tab === "feature" &&
          (detail?.feature ? <p>{detail.feature}</p> : <EmptyContent />)}

        {tab === "ingredients" &&
          (ingredients.length > 0 ? (
            <ul className="space-y-2.5">
              {ingredients.map((ing) => {
                const matched = ing.symptoms.includes(symptom);
                return (
                  <li
                    key={ing.name}
                    className={`rounded-md border p-3 ${
                      matched ? "border-brand-200 bg-brand-50/60" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {ing.name}
                      </span>
                      {ing.certificationType && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            ing.certificationType === "고시형"
                              ? "bg-brand-100 text-brand-700"
                              : "bg-accent-100 text-accent-700"
                          }`}
                        >
                          {ing.certificationType}
                        </span>
                      )}
                      {matched && (
                        <span className="rounded bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                          #{symptom} 매핑
                        </span>
                      )}
                    </div>
                    {ing.dailyIntake && (
                      <p className="mt-1 text-xs text-slate-500">
                        일일 섭취량: {ing.dailyIntake}
                      </p>
                    )}
                    {ing.note && (
                      <p className="mt-0.5 text-xs text-slate-600">{ing.note}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyContent />
          ))}

        {tab === "mechanism" &&
          (detail?.mechanism ? <p>{detail.mechanism}</p> : <EmptyContent />)}

        {tab === "selling" &&
          (detail && detail.sellingPoints.length > 0 ? (
            <ul className="space-y-2">
              {detail.sellingPoints.map((point, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyContent />
          ))}
      </div>

      <BroadcastBand
        ingredients={ingredients.map((i) => i.name)}
        broadcast={broadcast}
        now={now}
      />

      {/* CTA + 고지 */}
      <footer className="border-t border-slate-100 px-5 py-4">
        <Link
          href={`/sourcing?symptom=${encodeURIComponent(symptom)}${
            sourcingQuery ? `&ingredients=${encodeURIComponent(sourcingQuery)}` : ""
          }`}
          className="block w-full rounded-md bg-brand-600 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-700"
        >
          이 원료로 상품 소싱 →
        </Link>
        {firstIngredient && (
          <Link
            href={`/titles?ingredient=${encodeURIComponent(firstIngredient)}&part=${encodeURIComponent(subcategory.name)}`}
            className="mt-2 block w-full rounded-md border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
          >
            상품명·태그 만들기 →
          </Link>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {COMPLIANCE_NOTICE}
        </p>
      </footer>
    </section>
  );
}

/**
 * ⑥ 홈쇼핑모아 방송 지표 — 이 증상에 추천된 원료가 지금 홈쇼핑에서 도는가.
 *
 * **지표가 없으면 띠를 통째로 숨기지 않고 한 줄로 알린다.** 87종 중 방송이 잡히는 원료가
 * 제한적이라, 그냥 사라지면 셀러는 "이 화면엔 원래 없는 것"으로 읽는다. 없다는 사실
 * 자체가 신호다 — 홈쇼핑이 안 미는 원료라는 뜻이라서 경쟁이 덜할 수도, 수요가 없을 수도 있다.
 *
 * 방송 **횟수로 순위를 매기지 않는다**: 홈쇼핑모아가 원료당 상위 10건만 주므로
 * 여러 원료가 나란히 10에 걸린다. 이 데이터로는 누가 더 많이 방송되는지 말할 수 없다.
 */
function BroadcastBand({
  ingredients,
  broadcast,
  now,
}: {
  ingredients: string[];
  broadcast: Record<string, BroadcastStat>;
  now: number;
}) {
  const hit = ingredients
    .map((name) => ({ name, stat: broadcast[name] }))
    .filter((x): x is { name: string; stat: BroadcastStat } => Boolean(x.stat))
    .filter((x) => x.stat.count > 0 || x.stat.upcoming.length > 0);

  // 추천 원료에 걸린 예정 방송을 준비 기간 긴 순으로 2건만
  const seen = new Set<string>();
  const upcoming = hit
    .flatMap(({ name, stat }) =>
      stat.upcoming.map((u) => ({ ...u, ingredient: name, lead: leadTime(u.at, now) })),
    )
    .filter((u): u is typeof u & { lead: NonNullable<typeof u.lead> } => u.lead !== null)
    .sort((a, b) => b.lead.days - a.lead.days)
    .filter((u) => {
      const k = `${u.name}|${u.at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 2);

  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-700">📺 홈쇼핑 방송 지표</h4>
        <Link
          href="/broadcast"
          className="text-xs text-slate-600 transition hover:text-brand-700"
        >
          편성 전체 →
        </Link>
      </div>

      {hit.length === 0 ? (
        <p className="text-xs leading-relaxed text-slate-600">
          이 증상에 추천된 원료는 최근 홈쇼핑 편성에 잡히지 않았습니다.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {hit.slice(0, 6).map(({ name, stat }) => (
              <span
                key={name}
                title={stat.titles.slice(0, 5).join("\n")}
                className="rounded border border-rose-100 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
              >
                {name}
                {stat.upcoming.length > 0 && (
                  <span className="ml-1 text-xs tabular-nums text-rose-500/70">
                    예정 {stat.upcoming.length}
                    {stat.upcoming.length >= 10 ? "+" : ""}
                  </span>
                )}
              </span>
            ))}
          </div>

          {upcoming.length > 0 && (
            <ul className="mt-2 space-y-1">
              {upcoming.map((u, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <span
                    className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold tabular-nums ${u.lead.tone}`}
                  >
                    {u.lead.label}
                  </span>
                  <span className="shrink-0 text-slate-600">{channelName(u.channel)}</span>
                  <span className="truncate text-slate-600" title={u.name}>
                    {u.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function EmptyContent() {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-slate-600">콘텐츠 준비 중</p>
      <p className="text-xs text-slate-600">
        고객 제공 데이터 시드(<code className="text-slate-500">npm run seed:contents</code>)
        후 표시됩니다.
      </p>
    </div>
  );
}
