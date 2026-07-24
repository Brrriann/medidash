"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WholesaleProduct } from "@/lib/data";
import { calcMargin, defaultRecommendedPrice } from "@/lib/margin";
import { WHOLESALE_SOURCES } from "@/lib/constants";

/**
 * 도매몰 통합 검색 (docs/SPEC.md §5-4)
 * 월 1회 크롤러 캐시 기준 — 실시간 조회 아님(범위 가드). 카드에서 추천 판매가
 * 조정 → 마진 미리보기, 마진계산기로 원가 자동 전달.
 */

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

const SOURCE_LABEL = Object.fromEntries(
  WHOLESALE_SOURCES.map((s) => [s.key, s.label]),
);

export function SourcingExplorer({
  products,
  initialQuery,
  symptom,
}: {
  products: WholesaleProduct[];
  initialQuery: string;
  symptom: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (source && p.source !== source) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.ingredients.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [products, query, source]);

  return (
    <div className="space-y-4">
      {/* 검색/필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="키워드 또는 원료명 검색 (예: 루테인)"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
        <div className="flex gap-1.5">
          <FilterChip active={source === null} onClick={() => setSource(null)}>
            전체
          </FilterChip>
          {WHOLESALE_SOURCES.map((s) => (
            <FilterChip
              key={s.key}
              active={source === s.key}
              onClick={() => setSource(source === s.key ? null : s.key)}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {symptom && (
        <p className="text-xs text-slate-500">
          인체 지도에서 <span className="font-semibold text-brand-700">#{symptom}</span>{" "}
          증상으로 넘어온 소싱입니다 — 매칭 원료가 검색어에 자동 입력되었습니다.
        </p>
      )}

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">검색 결과가 없습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            다른 키워드로 검색하거나 필터를 해제해 보세요
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: WholesaleProduct }) {
  const [price, setPrice] = useState(defaultRecommendedPrice(product.priceWholesale));
  // 미리보기 가정: 스마트스토어 수수료 5.5% + 배송비 3,000원 (계산기에서 조정)
  const preview = calcMargin({
    cost: product.priceWholesale,
    price,
    feeRate: 5.5,
    shipping: 3000,
    extraCost: 0,
  });

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700">
          {SOURCE_LABEL[product.source] ?? product.source}
        </span>
        {product.isSample && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            샘플
          </span>
        )}
      </div>

      <h3 className="min-h-[40px] text-sm font-semibold leading-snug text-slate-800">
        {product.name}
      </h3>

      {product.ingredients.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {product.ingredients.map((ing) => (
            <span
              key={ing}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700"
            >
              {ing}
            </span>
          ))}
        </div>
      )}

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">도매가</dt>
          <dd className="font-bold text-slate-800">{won(product.priceWholesale)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">추천 판매가 (기본 ×2)</dt>
          <dd>
            <input
              type="number"
              value={price}
              step={100}
              min={0}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-300 px-1.5 py-1 text-right text-xs font-semibold outline-none focus:border-brand-500"
              aria-label="추천 판매가 조정"
            />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">예상 마진 (수수료 5.5%·배송 3천 가정)</dt>
          <dd
            className={`font-bold ${
              preview.margin >= 0 ? "text-brand-700" : "text-red-600"
            }`}
          >
            {won(preview.margin)} ({preview.marginRate}%)
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Link
          href={`/margin?cost=${product.priceWholesale}${product.isSample ? "" : `&ref=${product.id}`}`}
          className="rounded-lg bg-brand-600 py-1.5 text-center text-xs font-bold text-white transition hover:bg-brand-700"
        >
          마진계산기
        </Link>
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          원본 보기 ↗
        </a>
        <Link
          href={`/studio?ingredient=${encodeURIComponent(product.ingredients[0] ?? product.name)}`}
          className="rounded-lg border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
        >
          썸네일 만들기
        </Link>
        <Link
          href={`/titles?ingredient=${encodeURIComponent(product.ingredients[0] ?? product.name)}`}
          className="rounded-lg border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
        >
          상품명 만들기
        </Link>
      </div>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-300 bg-white text-slate-500 hover:border-brand-400"
      }`}
    >
      {children}
    </button>
  );
}
