"use client";

import { useState } from "react";
import type { BodyCategory, SubcategoryDetail } from "@/lib/taxonomy/types";
import type { BroadcastStat } from "@/lib/data";
import { MAPPED_REGIONS } from "./BodyMapSvg";
import { BodyMapView } from "./BodyMapView";
import { SubcategoryCards } from "./SubcategoryCards";
import { SymptomChips } from "./SymptomChips";
import { DetailPanel } from "./DetailPanel";

/**
 * 인체 지도 탐색 오케스트레이터 (docs/UI-PLAN.md §4 인터랙션 흐름)
 * 지도 클릭(대분류) → 중분류 카드 → 증상 칩 → 4-Tab 상세 패널 → 소싱 CTA
 */
export function BodyMapExplorer({
  categories,
  details,
  broadcast,
  now,
}: {
  categories: BodyCategory[];
  details: Record<string, SubcategoryDetail>;
  /** 원료별 홈쇼핑 방송 지표 — 상세 패널 ⑥번 항목에 쓴다 */
  broadcast: Record<string, BroadcastStat>;
  /** 서버 기준 시각 (리드타임 계산) */
  now: number;
}) {
  const [catSlug, setCatSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);

  const category = categories.find((c) => c.slug === catSlug) ?? null;
  const subcategory =
    category?.subcategories.find((s) => s.slug === subSlug) ?? null;

  /** 실루엣에 위치가 없어 라벨 칩으로만 표시되는 계통 (면역·방어계, 내분비계 등) */
  const chipOnly = categories.filter(
    (c) => !MAPPED_REGIONS.includes(c.svgRegion),
  );

  const selectCategory = (slug: string) => {
    setCatSlug(slug);
    setSubSlug(null);
    setSymptom(null);
  };
  const selectSubcategory = (slug: string) => {
    setSubSlug(slug);
    setSymptom(null);
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(300px,5fr)_7fr]">
      {/* ── 좌: 인체 지도 ── */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">인체 지도</h2>
          <span className="text-[11px] text-slate-400">
            드래그로 회전 · 핫스팟 클릭
          </span>
        </div>

        <div className="h-[440px]">
          <BodyMapView
            categories={categories}
            selectedSlug={catSlug}
            onSelect={selectCategory}
          />
        </div>

        {/* 계통 바로가기 칩 — 위치가 애매한 계통 포함 전체 (접근성 대안 겸용) */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-medium text-slate-400">
            계통 바로가기
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const selected = cat.slug === catSlug;
              const isChipOnly = chipOnly.includes(cat);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => selectCategory(cat.slug)}
                  aria-pressed={selected}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                    selected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : isChipOnly
                        ? "border-accent-300 bg-accent-50 text-accent-800 hover:border-accent-500"
                        : "border-slate-200 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-700"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 우: 중분류 → 증상 칩 → 4-Tab 패널 ── */}
      <div className="space-y-4">
        {!category && (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 text-center">
            <p className="text-sm font-semibold text-slate-500">
              지도에서 계통을 선택하세요
            </p>
            <p className="mt-1 text-xs text-slate-400">
              대분류 → 부위/기능 → 증상 키워드 순서로 좁혀 들어갑니다
            </p>
          </div>
        )}

        {category && (
          <div className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-slate-800">
                {category.name}{" "}
                <span className="font-normal text-slate-400">부위/기능 선택</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                {category.subcategories.length}개
              </span>
            </div>
            <SubcategoryCards
              category={category}
              selectedSlug={subSlug}
              onSelect={selectSubcategory}
            />

            {subcategory && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-medium text-slate-500">
                  증상 키워드 —{" "}
                  <span className="text-slate-400">
                    클릭하면 상세 패널이 열립니다
                  </span>
                </p>
                <SymptomChips
                  subcategory={subcategory}
                  selectedSymptom={symptom}
                  onSelect={setSymptom}
                />
              </div>
            )}
          </div>
        )}

        {category && subcategory && symptom && (
          <DetailPanel
            key={`${subcategory.slug}:${symptom}`}
            category={category}
            subcategory={subcategory}
            symptom={symptom}
            detail={details[subcategory.slug]}
            broadcast={broadcast}
            now={now}
            onClose={() => setSymptom(null)}
          />
        )}
      </div>
    </div>
  );
}
