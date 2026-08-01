"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WholesaleProduct, BroadcastStat, KeywordStat } from "@/lib/data";
import { calcMargin, defaultRecommendedPrice } from "@/lib/margin";
import { WHOLESALE_SOURCES } from "@/lib/constants";
import { FilterChip } from "@/components/ui/FilterChip";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MALL_LINKS, mallSearchKeyword } from "@/lib/products/mall-search";

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

/**
 * 정렬 기준.
 *
 * 종전에는 수집순 하나로 고정이라 6,003건이 사실상 무작위로 나왔다.
 * 셀러가 실제로 묻는 것은 세 가지다 — 얼마나 싼가, 얼마나 찾는가, 방송이 붙는가.
 *
 * **비교값이 없는 상품을 뒤로 보낸다.** 지표가 없는 상품(원료 미매칭 29%)이 0으로
 * 취급되어 앞에 오면 정렬이 오히려 쓸모없어진다.
 */
type SortKey = "default" | "price" | "demand" | "broadcast";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: "수집순" },
  { key: "price", label: "도매가 낮은 순" },
  { key: "demand", label: "검색 수요 높은 순" },
  { key: "broadcast", label: "방송 예정 많은 순" },
];

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
  const [sort, setSort] = useState<SortKey>("default");
  const [shown, setShown] = useState(PAGE_STEP);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = products.filter((p) => {
      if (source && p.source !== source) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.ingredients.some((i) => i.toLowerCase().includes(q))
      );
    });
    if (sort === "default") return hit;

    // 지표가 없으면 null — 정렬에서 뒤로 보낸다(0으로 취급하면 앞줄을 차지한다)
    const score = (p: WholesaleProduct): number | null => {
      if (sort === "price") return p.priceWholesale;
      if (sort === "demand") {
        const v = p.ingredients
          .map((i) => keywords[i]?.demandIndex)
          .filter((d): d is number => d != null);
        return v.length ? Math.max(...v) : null;
      }
      const v = p.ingredients
        .map((i) => broadcast[i]?.upcoming.length)
        .filter((n): n is number => n != null);
      return v.length ? Math.max(...v) : null;
    };
    const asc = sort === "price";
    return [...hit].sort((a, b) => {
      const x = score(a),
        y = score(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return asc ? x - y : y - x;
    });
  }, [products, query, source, sort, keywords, broadcast]);

  // 검색/필터/정렬이 바뀌면 렌더 개수 초기화
  useEffect(() => setShown(PAGE_STEP), [query, source, sort]);
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
            className="w-full rounded-md border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="정렬"
          className="rounded-md border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
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
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">검색 결과가 없습니다</p>
          <p className="mt-1 text-xs text-slate-600">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
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
    <article className="flex flex-col card p-4 transition hover:border-brand-300">
      <ProductThumb src={product.imageUrl} alt={product.name} />
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded bg-accent-100 px-2 py-0.5 text-xs font-bold text-accent-700">
          {SOURCE_LABEL[product.source] ?? product.source}
        </span>
        {product.isSample && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
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
              className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
            >
              {ing}
            </span>
          ))}
        </div>
      )}

      <MarketSignals demand={kw} broadcast={bc} />

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">도매가</dt>
          <dd className="font-bold text-slate-800">{won(product.priceWholesale)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-600">추천 판매가 (기본 ×2)</dt>
          <dd>
            <MoneyInput
              value={price}
              onChange={setPrice}
              aria-label="추천 판매가 조정"
              className="w-28 rounded-md border border-slate-300 px-2 py-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-brand-500"
            />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">예상 최종마진 (쿠팡 9.6%·배송 3천 가정)</dt>
          <dd
            className={`font-bold ${
              preview.finalMargin >= 0 ? "text-brand-700" : "text-red-600"
            }`}
          >
            {won(preview.finalMargin)} ({(preview.finalMarginRate * 100).toFixed(1)}%)
          </dd>
        </div>
      </dl>

      {/*
        기본으로는 **두 개만** 보인다.

        종전에는 카드 하나에 누를 것이 아홉 개(타몰 4 + 작업 5)였다. 글자를 키우자
        그 덩어리만 179px, 카드의 26%가 됐고 한 화면에 카드 한 장이 안 들어왔다.
        무엇보다 주 사용자가 50~60대라 **선택지가 많은 것 자체가 부담**이다.

        소싱 단계에서 셀러가 하는 판단은 "이거 할 만한가"다 — 마진을 보고 원본을
        확인하면 끝난다. 썸네일·상품명·후킹페이지는 상품을 고르고 난 다음 일이라
        기본 화면에서 자리를 차지할 이유가 없다. 타몰 시세도 마찬가지다.
      */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          href={`/margin?cost=${product.priceWholesale}${product.isSample ? "" : `&ref=${product.id}`}`}
          className="rounded-md bg-brand-700 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-800"
        >
          마진 계산
        </Link>
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          원본 보기 ↗
        </a>
      </div>

      <details className="mt-2 border-t border-slate-100 pt-2">
        <summary className="cursor-pointer list-none rounded-md py-3 text-center text-sm font-semibold text-slate-600 transition hover:text-brand-700">
          이 상품으로 만들기 · 시세 보기 ▾
        </summary>

        <MallCompare name={product.name} ingredients={product.ingredients} />

        <div className="mt-2 grid gap-2">
          <Link
            href={`/studio?ingredient=${encodeURIComponent(product.ingredients[0] ?? product.name)}${product.isSample ? "" : `&ref=${product.id}`}`}
            className="rounded-md border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
          >
            썸네일 만들기
          </Link>
          <Link
            href={`/titles?ingredient=${encodeURIComponent(product.ingredients[0] ?? product.name)}`}
            className="rounded-md border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
          >
            상품명 만들기
          </Link>
          {/*
            샘플에서도 보여준다. 종전엔 숨겼는데 mock은 전부 샘플이라 **진입로가 통째로
            사라져** "이미지 생성을 어디서 시작하느냐"가 됐다. 샘플로 들어가도 화면은 뜨고,
            생성이 안 되는 이유는 그 화면에서 안내한다.
          */}
          <Link
            href={`/hook?ref=${product.id}`}
            className="rounded-md bg-slate-900 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-700"
          >
            후킹페이지 만들기
          </Link>
        </div>
      </details>
    </article>
  );
}

/**
 * 시장 신호 — 수요 · 경쟁 · 방송을 괘선으로 가른 한 줄.
 *
 * **종전에는 이 값들이 배지의 title 속성 안에 있었다.** 경쟁 상품수 20만 건 같은
 * 판단 근거가 마우스를 올려야 나왔고, 모바일에선 아예 볼 수 없었다. 표면으로 꺼낸다.
 *
 * 수요는 숫자만 두지 않고 높음/보통/낮음을 같이 보인다 — 원지표가 앵커(콜라겐)=1.0
 * 기준 상대값이라 "0.67×"만으로는 셀러에게 아무 뜻이 없다. 구간은 수집한 82종
 * 분포(중앙값 0.33)에 맞췄다.
 *
 * 수요와 경쟁을 하나의 점수로 합치지 않는다 — 상대지수와 절대 상품수는 단위가 달라
 * 합치면 근거 없는 숫자가 된다. 판단은 셀러가 두 값을 보고 한다.
 *
 * 값이 없으면 칸을 지우지 않고 &mdash; 로 남긴다. 그리고 값 줄은 절대 접히지 않게 한다
 * (`whitespace-nowrap`). 둘 다 **띠 높이를 카드마다 같게** 두려는 것이다 — 높이가 흔들리면
 * 아래 내용이 카드마다 다른 위치에 놓여 여러 장을 훑을 때 눈이 걸린다.
 * 실측에서 "방송 2 · 예정 2"가 두 줄로 접혀 46px / 62px로 갈렸다.
 */
function MarketSignals({
  demand,
  broadcast,
}: {
  demand?: KeywordStat;
  broadcast?: BroadcastStat;
}) {
  const d = demand?.demandIndex ?? null;
  const level = d == null ? null : d >= 0.8 ? "높음" : d >= 0.25 ? "보통" : "낮음";
  const tone =
    d == null
      ? "text-slate-500"
      : d >= 0.8
        ? "text-brand-700"
        : d >= 0.25
          ? "text-slate-700"
          : "text-slate-600";
  const up = broadcast?.upcoming.length ?? 0;

  return (
    <div className="ruled-grid mt-2.5 grid grid-cols-3 text-center">
      <div className="bg-white px-1 py-1.5">
        <p className="text-xs text-slate-600">검색 수요</p>
        <p
          className={`whitespace-nowrap text-xs font-bold tabular-nums ${tone}`}
          title={
            d == null
              ? "네이버 검색량 미수집 원료입니다"
              : `${demand!.keyword} — 콜라겐=1.0 기준 최근 12개월 평균`
          }
        >
          {level ? `${level} ${d!.toFixed(2)}×` : "—"}
        </p>
      </div>
      <div className="bg-white px-1 py-1.5">
        <p className="text-xs text-slate-600">경쟁 상품</p>
        <p
          className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-700"
          title="네이버쇼핑에 등록된 같은 키워드 상품수 — 많을수록 경쟁이 심합니다"
        >
          {demand?.competition != null
            ? demand.competition.toLocaleString("ko-KR")
            : "—"}
        </p>
      </div>
      <div className="bg-white px-1 py-1.5">
        <p className="text-xs text-slate-600">홈쇼핑</p>
        {/* 라벨이 이미 "홈쇼핑"이라 값에서 '방송'을 뺀다 — 76px 칸에 안 접히고 들어간다 */}
        <p
          className={`whitespace-nowrap text-xs font-bold tabular-nums ${up > 0 ? "text-rose-700" : "text-slate-600"}`}
          title={
            broadcast?.titles.length
              ? "최근 방송 상품:\n- " + broadcast.titles.slice(0, 6).join("\n- ")
              : "최근 홈쇼핑 편성에 잡히지 않은 원료입니다"
          }
        >
          {broadcast && broadcast.count > 0
            ? `${broadcast.count}${broadcast.count >= 10 ? "+" : ""}${up > 0 ? ` · 예정${up}` : ""}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

/**
 * 타몰 시세 확인.
 *
 * 저쪽(벤치마킹 사이트)은 카드에 타몰 실판매가를 숫자로 박아 둔다. 우리는 그 값을
 * 갖고 있지 않고, 가지려면 매일 긁어야 하는데 SPEC §2가 실시간 연동을 막는다.
 * 대신 **셀러를 그 몰의 검색 결과로 보낸다** — 데이터 0, 갱신 부담 0, 항상 최신이다.
 */
function MallCompare({
  name,
  ingredients,
}: {
  name: string;
  ingredients: string[];
}) {
  const keyword = mallSearchKeyword(name, ingredients);
  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5">
      <p className="mb-1 text-xs text-slate-600">
        타몰 시세 —{" "}
        <span className="font-medium text-slate-500">{keyword}</span> 검색
      </p>
      <div className="grid grid-cols-4 gap-1">
        {MALL_LINKS.map((m) => (
          <a
            key={m.key}
            href={m.url(keyword)}
            target="_blank"
            rel="noreferrer noopener"
            /* py-2.5로 44px 표적을 만든다 — 손가락이나 노안 마우스로도 빗나가지 않게 */
            className="rounded-md border border-slate-300 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
          >
            {m.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * 상품 대표 이미지 썸네일. 프로토콜상대(//) URL은 https로, 로드 실패/없음은 플레이스홀더.
 *
 * 정사각형(aspect-square)이 아니라 **고정 높이**다. 카드 폭을 따라 커지던 탓에
 * 1280px 화면에서 썸네일만 366px, 카드 하나가 886px가 되어 한 화면에 한 장밖에
 * 안 들어왔다. 6,003건을 훑는 화면에서 그건 못 쓴다.
 * 소싱 단계에서 이미지가 하는 일은 "이 제품이 맞나" 알아보는 것뿐이라 176px면 된다.
 */
function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const url = src?.startsWith("//") ? `https:${src}` : src;
  const [broken, setBroken] = useState(false);
  return (
    <div className="mb-3 h-44 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
      {url && !broken ? (
        // 외부 도매몰/CDN 이미지 — next/image 도메인 설정 없이 단순 표시
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          /* contain으로 바꾼다 — cover는 상자에 맞추려고 가장자리를 잘라내는데,
             건기식 상품 사진은 패키지 전체가 보여야 무엇인지 알아본다. */
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
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

