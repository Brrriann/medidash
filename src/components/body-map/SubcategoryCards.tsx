"use client";

import type { BodyCategory } from "@/lib/taxonomy/types";

/** 중분류(부위/기능) 카드 리스트 — 셀러 판매 각도 결정 (docs/UI-PLAN.md §4 step 2) */
export function SubcategoryCards({
  category,
  selectedSlug,
  onSelect,
}: {
  category: BodyCategory;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {category.subcategories.map((sub) => {
        const selected = sub.slug === selectedSlug;
        return (
          <button
            key={sub.slug}
            type="button"
            onClick={() => onSelect(sub.slug)}
            aria-pressed={selected}
            className={`rounded-md border px-3 py-2.5 text-left transition ${
              selected
                ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50"
            }`}
          >
            <span className="block text-sm font-semibold text-slate-800">
              {sub.name}
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              증상 키워드 {sub.symptoms.length}개
            </span>
          </button>
        );
      })}
    </div>
  );
}
