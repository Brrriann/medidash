"use client";

import type { BodySubcategory } from "@/lib/taxonomy/types";

/** 소분류 증상 키워드 칩 — 클릭 시 4-Tab 상세 패널 오픈 (docs/UI-PLAN.md §4 step 3) */
export function SymptomChips({
  subcategory,
  selectedSymptom,
  onSelect,
}: {
  subcategory: BodySubcategory;
  selectedSymptom: string | null;
  onSelect: (keyword: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {subcategory.symptoms.map((keyword) => {
        const selected = keyword === selectedSymptom;
        return (
          <button
            key={keyword}
            type="button"
            onClick={() => onSelect(keyword)}
            aria-pressed={selected}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selected
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-700"
            }`}
          >
            #{keyword}
          </button>
        );
      })}
    </div>
  );
}
