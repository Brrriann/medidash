"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WholesaleProduct, BroadcastStat, KeywordStat } from "@/lib/data";
import { calcMargin, defaultRecommendedPrice } from "@/lib/margin";
import { WHOLESALE_SOURCES } from "@/lib/constants";

/**
 * 도매몰 통합 검색 (docs/SPEC.md §5-4)
 * 월 1회 크롤러 캐시 기준 — 실시간 조회 아님(범위 가드). 카드에서 추천 판매가
 * 조정 → 마진 미리보기, 마진계산기로 원가 자동 전달.
 */

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

const PAGE_STEP = 120; // 한 번에 렌더할 카드 수 (수천 건 동시 렌더 방지)

const SOURCE_LABEL = Object.fromEntries(
  WHOLESALE_SOURCES.map((s) => [s.key, s.label]),
);

export function SourcingExplorer({
  products,
  broadcast,
  keywords,
  initialQuery,
  symptom,
}: {
  products: WholesaleProduct[];
  broadcast: Record<string, BroadcastStat>;
  keywords: Record<string, KeywordStat>;
  initialQuery: string;
  symptom: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_STEP);

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

  // 검색/필터가 바뀌면 렌더 개수 초기화
  useEffect(() => setShown(PAGE_STEP), [query, source]);
  const visible = filtered.slice(0, shown);

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
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            총{" "}
            <span className="font-semibold text-slate-700">
              {filtered.length.toLocaleString("ko-KR")}
            </span>
            개
            {filtered.length > visible.length &&
              ` 중 ${visible.length.toLocaleString("ko-KR")}개 표시`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                broadcast={broadcast}
                keywords={keywords}
              />
            ))}
          </div>
          {filtered.length > visible.length && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_STEP)}
                className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
              >
                더 보기 ({(filtered.length - visible.length).toLocaleString("ko-KR")}개 남음)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  broadcast,
  keywords,
}: {
  product: WholesaleProduct;
  broadcast: Record<string, BroadcastStat>;
  keywords: Record<string, KeywordStat>;
}) {
  const [price, setPrice] = useState(defaultRecommendedPrice(product.priceWholesale));
  // 원료 중 방송 노출이 가장 많은 지표 (홈쇼핑 수요 신호)
  const bc = product.ingredients
    .map((ing) => broadcast[ing])
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)[0];
  // 원료 중 검색 수요가 가장 높은 지표 (네이버 수요 신호)
  const kw = product.ingredients
    .map((ing) => keywords[ing])
    .filter((k) => k && k.demandIndex != null)
    .sort((a, b) => b.demandIndex! - a.demandIndex!)[0];
  // 미리보기 가정: 쿠팡 뷰티/헬스 수수료 9.6% · 지불배송비 3,000원 · 종소세 6% (계산기에서 조정)
  const preview = calcMargin({
    price,
    cost: product.priceWholesale,
    customerShipping: 0,
    paidShipping: 3000,
    packaging: 0,
    feeRate: 0.096,
    platform: "coupang",
    incomeTaxRate: 0.06,
  });

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <ProductThumb src={product.imageUrl} alt={product.name} />
      <div className="mb-2 flex items-start justify-between gap-2">
        {/* 도매몰·방송·수요 3종이 겹치므로 좁은 카드에선 줄바꿈시킨다 */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700">
            {SOURCE_LABEL[product.source] ?? product.source}
          </span>
          {bc && bc.count > 0 && (
            <span
              title={`홈쇼핑모아 최근 방송 상품${bc.titles.length ? ":\n- " + bc.titles.slice(0, 6).join("\n- ") : ""}`}
              className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
            >
              📺 방송 {bc.count}
              {bc.count >= 10 ? "+" : ""}
            </span>
          )}
          {kw && <DemandBadge stat={kw} />}
        </div>
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
          <dt className="text-slate-400">예상 최종마진 (쿠팡 9.6%·배송 3천 가정)</dt>
          <dd
            className={`font-bold ${
              preview.finalMargin >= 0 ? "text-brand-700" : "text-red-600"
            }`}
          >
            {won(preview.finalMargin)} ({(preview.finalMarginRate * 100).toFixed(1)}%)
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Link
          href={`/margin?cost=${product.priceWholesale}${product.isSample ? "" : `&ref=${product.id}`}`}
          className="rounded-lg bg-brand-600 py-1.5 text-center text-xs font-bold text-white transition hover:bg-brand-700"
        >
          마진 계산
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

/**
 * 네이버 검색 수요 배지.
 *
 * 원지표는 앵커(콜라겐)=1.0 기준 상대값이라 카드에 "0.67×"만 띄우면 셀러에게 아무 뜻이 없다.
 * 그래서 카드에는 높음/보통/낮음만 보이고, 실수치와 경쟁 상품수는 툴팁으로 준다.
 * 구간은 수집한 82종 분포(중앙값 0.33)에 맞췄다.
 *
 * 수요와 경쟁을 하나의 점수로 합치지 않는다 — 상대지수와 절대 상품수는 단위가 달라
 * 합치면 근거 없는 숫자가 된다. 판단은 셀러가 두 값을 보고 한다.
 */
function DemandBadge({ stat }: { stat: KeywordStat }) {
  const d = stat.demandIndex!;
  const level = d >= 0.8 ? "높음" : d >= 0.25 ? "보통" : "낮음";
  const tone =
    d >= 0.8
      ? "bg-emerald-100 text-emerald-700"
      : d >= 0.25
        ? "bg-slate-100 text-slate-600"
        : "bg-slate-50 text-slate-400";
  const tip =
    `${stat.keyword} — 네이버 검색 수요 ${d.toFixed(2)}× (콜라겐=1.0 기준, 최근 12개월 평균)` +
    (stat.competition != null
      ? `\n네이버쇼핑 등록 상품 ${stat.competition.toLocaleString("ko-KR")}건`
      : "");

  return (
    <span
      title={tip}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}
    >
      🔍 수요 {level}
    </span>
  );
}

/** 상품 대표 이미지 썸네일. 프로토콜상대(//) URL은 https로, 로드 실패/없음은 플레이스홀더. */
function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const url = src?.startsWith("//") ? `https:${src}` : src;
  const [broken, setBroken] = useState(false);
  return (
    <div className="mb-3 aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
      {url && !broken ? (
        // 외부 도매몰/CDN 이미지 — next/image 도메인 설정 없이 단순 표시
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}
    </div>
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
