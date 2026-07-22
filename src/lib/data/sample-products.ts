/**
 * 도매몰 상품 캐시 mock 데이터 — 개발·시연 전용.
 * 실데이터는 W2 크롤러(workers/crawl-wholesale.ts)가 wholesale_products에 월 1회 upsert.
 * source_url은 실제 상품이 아닌 도매몰 홈 링크(샘플임을 명시).
 */
export interface SampleProduct {
  id: number;
  source: "gonyb2b" | "ggsan" | "upickb2b";
  sourceUrl: string;
  name: string;
  priceWholesale: number;
  /** 매칭 원료명 (ingredients.aliases 사전 매칭 결과에 해당) */
  ingredients: string[];
  crawledAt: string;
}

const CRAWLED_AT = "2026-07-01T03:00:00+09:00"; // 샘플 갱신일 (월 1회 배치 가정)

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 1,
    source: "gonyb2b",
    sourceUrl: "https://gonyb2b.com",
    name: "[샘플] 루테인 지아잔틴 164 눈건강 60캡슐",
    priceWholesale: 8900,
    ingredients: ["루테인", "지아잔틴"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 2,
    source: "ggsan",
    sourceUrl: "https://www.ggsan.com",
    name: "[샘플] 프리미엄 밀크씨슬 실리마린 130 간건강 90정",
    priceWholesale: 12500,
    ingredients: ["밀크씨슬 추출물"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 3,
    source: "upickb2b",
    sourceUrl: "https://upickb2b.com",
    name: "[샘플] 장케어 프로바이오틱스 100억 유산균 30포",
    priceWholesale: 9800,
    ingredients: ["프로바이오틱스"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 4,
    source: "gonyb2b",
    sourceUrl: "https://gonyb2b.com",
    name: "[샘플] 알티지 오메가3 rTG 1000 혈행건강 60캡슐",
    priceWholesale: 13900,
    ingredients: ["오메가3 (EPA·DHA)"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 5,
    source: "ggsan",
    sourceUrl: "https://www.ggsan.com",
    name: "[샘플] 쏘팔메토 옥타코사놀 전립선 60캡슐",
    priceWholesale: 11200,
    ingredients: ["쏘팔메토 열매 추출물"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 6,
    source: "upickb2b",
    sourceUrl: "https://upickb2b.com",
    name: "[샘플] 관절엔 콘드로이친 1200 MSM 90정",
    priceWholesale: 15800,
    ingredients: ["콘드로이친", "MSM (디메틸설폰)"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 7,
    source: "gonyb2b",
    sourceUrl: "https://gonyb2b.com",
    name: "[샘플] 6년근 홍삼정 스틱 면역케어 30포",
    priceWholesale: 17500,
    ingredients: ["홍삼"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 8,
    source: "ggsan",
    sourceUrl: "https://www.ggsan.com",
    name: "[샘플] 꿀잠 테아닌 250 수면건강 60정",
    priceWholesale: 8400,
    ingredients: ["테아닌"],
    crawledAt: CRAWLED_AT,
  },
  {
    id: 9,
    source: "upickb2b",
    sourceUrl: "https://upickb2b.com",
    name: "[샘플] 가르시니아 다이어트컷 HCA 1000 56정",
    priceWholesale: 7600,
    ingredients: ["가르시니아캄보지아 추출물"],
    crawledAt: CRAWLED_AT,
  },
];
