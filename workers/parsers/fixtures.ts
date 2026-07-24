/**
 * dry-run 픽스처 생성기 — 실사이트 없이 파이프라인(매칭·upsert·로깅)을 검증하기 위한 가짜 상품.
 * 상품명에 실제 원료명을 넣어 원료 매칭이 동작하는지도 함께 확인된다.
 * ⚠️ 개발/검증 전용 — 실제 크롤 데이터가 아니다.
 */
import type { RawProduct, WholesaleSource } from "../lib/types";

/** 원료명 · 함량표기 · 규격 조합으로 그럴듯한 상품명 생성 */
const SAMPLE_ROWS: { ingredient: string; spec: string; detail: string }[] = [
  { ingredient: "루테인 지아잔틴", spec: "60캡슐", detail: "마리골드꽃추출물 루테인 20mg, 지아잔틴 4mg" },
  { ingredient: "밀크씨슬", spec: "90정", detail: "밀크씨슬 추출물(실리마린 130mg)" },
  { ingredient: "프로바이오틱스", spec: "30포", detail: "유산균 100억 CFU 락토바실러스 복합" },
  { ingredient: "오메가3", spec: "60캡슐", detail: "알티지 rTG EPA DHA 1000mg" },
  { ingredient: "쏘팔메토", spec: "60캡슐", detail: "쏘팔메토 열매 추출물 로르산 기준 320mg" },
  { ingredient: "콘드로이친 MSM", spec: "90정", detail: "콘드로이친황산 1200mg, 식이유황 MSM" },
  { ingredient: "홍삼", spec: "30포", detail: "6년근 홍삼농축액 진세노사이드" },
  { ingredient: "테아닌", spec: "60정", detail: "L-테아닌 250mg 수면건강" },
  { ingredient: "가르시니아", spec: "56정", detail: "가르시니아캄보지아 추출물 HCA 1000mg" },
  { ingredient: "비오틴", spec: "120정", detail: "비오틴 모발 손톱 건강" },
];

const SOURCE_PREFIX: Record<WholesaleSource, string> = {
  gonyb2b: "건온연",
  ggsan: "건강산",
  upickb2b: "유픽",
};

const BASE_URL: Record<WholesaleSource, string> = {
  gonyb2b: "https://gonyb2b.com",
  ggsan: "https://www.ggsan.com",
  upickb2b: "https://upickb2b.com",
};

/** source별 픽스처 상품 limit개 생성 (가격은 인덱스 기반 결정값 — Math.random 미사용) */
export function makeFixtures(source: WholesaleSource, limit: number): RawProduct[] {
  const rows = SAMPLE_ROWS.slice(0, Math.max(0, Math.min(limit, SAMPLE_ROWS.length)));
  return rows.map((row, i) => {
    const price = 7000 + i * 900; // 결정적 가격
    return {
      sourceUrl: `${BASE_URL[source]}/product/fixture-${i + 1}`,
      name: `[DRYRUN][${SOURCE_PREFIX[source]}] ${row.ingredient} ${row.spec}`,
      priceWholesale: price,
      imageUrl: `${BASE_URL[source]}/img/fixture-${i + 1}.jpg`,
      detailText: `${row.ingredient} / ${row.detail} / ${row.spec}`,
      detail: { fixture: true, spec: row.spec },
    };
  });
}
