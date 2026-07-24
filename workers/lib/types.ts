/** 도매몰 크롤러 공통 타입 (docs/SPEC.md §6.2) */

export type WholesaleSource = "gonyb2b" | "ggsan" | "upickb2b";

/** 파서가 상세 페이지에서 뽑아낸 원시 상품 데이터 */
export interface RawProduct {
  /** 상세 페이지 URL (upsert 고유키) */
  sourceUrl: string;
  name: string;
  /** 도매가(원) — 파싱 실패 시 null */
  priceWholesale: number | null;
  imageUrl: string | null;
  /** 원료·함량 등 파싱 텍스트 (원료 매칭 입력) */
  detailText: string;
  /** 구조화 상세(선택) — jsonb로 저장 */
  detail?: Record<string, unknown>;
}

/** 원료 매칭까지 끝난 최종 upsert 레코드 */
export interface WholesaleRecord extends RawProduct {
  source: WholesaleSource;
  ingredientIds: number[];
  crawledAt: string;
}

/** 크롤 1회 실행 옵션 */
export interface CrawlOptions {
  /** 실계정·네트워크 없이 픽스처로 파이프라인만 검증 */
  dryRun: boolean;
  /** 소스별 최대 수집 상품 수 (실계정 소량 검증용) */
  limitPerSource: number;
  /** 특정 소스만 실행 (미지정 시 전체) */
  onlySource?: WholesaleSource;
}

/** 원료 사전 항목 (매칭 입력) */
export interface IngredientDict {
  id: number;
  name: string;
  aliases: string[];
}
