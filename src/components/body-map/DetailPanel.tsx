"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  BodyCategory,
  BodySubcategory,
  SubcategoryDetail,
} from "@/lib/taxonomy/types";
import { COMPLIANCE_NOTICE, DETAIL_TABS, type DetailTabKey } from "@/lib/constants";

/**
 * 4-Tab 상세 패널 — ①특징 ②추천원료 ③기전원리 ④셀링포인트 (docs/UI-PLAN.md §5)
 * 하단 CTA: "이 원료로 상품 소싱" → 도매몰 통합 검색 (W2 연결)
 */
export function DetailPanel({
  category,
  subcategory,
  symptom,
  detail,
  onClose,
}: {
  category: BodyCategory;
  subcategory: BodySubcategory;
  symptom: string;
  detail: SubcategoryDetail | undefined;
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
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* 헤더 */}
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 pb-3 pt-4">
        <div>
          <p className="text-xs text-slate-400">
            {category.name} · {subcategory.name}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">
            #{symptom}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {detail?.source === "mock" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              개발용 샘플
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="패널 닫기"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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
                    className={`rounded-xl border p-3 ${
                      matched ? "border-brand-200 bg-brand-50/60" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {ing.name}
                      </span>
                      {ing.certificationType && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            ing.certificationType === "고시형"
                              ? "bg-brand-100 text-brand-700"
                              : "bg-accent-100 text-accent-700"
                          }`}
                        >
                          {ing.certificationType}
                        </span>
                      )}
                      {matched && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
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
                      <p className="mt-0.5 text-xs text-slate-400">{ing.note}</p>
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
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
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

      {/* CTA + 고지 */}
      <footer className="border-t border-slate-100 px-5 py-4">
        <Link
          href={`/sourcing?symptom=${encodeURIComponent(symptom)}${
            sourcingQuery ? `&ingredients=${encodeURIComponent(sourcingQuery)}` : ""
          }`}
          className="block w-full rounded-xl bg-brand-600 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-700"
        >
          이 원료로 상품 소싱 →
        </Link>
        {firstIngredient && (
          <Link
            href={`/titles?ingredient=${encodeURIComponent(firstIngredient)}&part=${encodeURIComponent(subcategory.name)}`}
            className="mt-2 block w-full rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
          >
            상품명·태그 만들기 →
          </Link>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {COMPLIANCE_NOTICE}
        </p>
      </footer>
    </section>
  );
}

function EmptyContent() {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-slate-400">콘텐츠 준비 중</p>
      <p className="text-xs text-slate-400">
        고객 제공 데이터 시드(<code className="text-slate-500">npm run seed:contents</code>)
        후 표시됩니다.
      </p>
    </div>
  );
}
