/** 대분류 — 인체 계통 (지도 클릭 진입점) */
export interface BodyCategory {
  slug: string;
  name: string;
  /** 인체 SVG 영역 id. 위치가 애매한 계통은 'chip' — 실루엣 옆 라벨 칩으로 표시 */
  svgRegion: string;
  sort: number;
  subcategories: BodySubcategory[];
}

/** 중분류 — 부위/기능 (셀러 판매 각도 결정, 사이드 패널 카드) */
export interface BodySubcategory {
  slug: string;
  name: string;
  sort: number;
  /** 소분류 — 증상 키워드 (원료·셀링포인트 매핑 트리거, 태그 칩) */
  symptoms: string[];
}

/** 원료 인증 구분 (식약처) */
export type CertificationType = "고시형" | "개별인정형";

export interface IngredientRec {
  name: string;
  certificationType: CertificationType | null;
  dailyIntake: string | null;
  note: string | null;
  /** 이 원료가 매핑된 증상 키워드 (비면 중분류 전체에 해당) */
  symptoms: string[];
}

/** 4-Tab 상세 패널 데이터 (특징/추천원료/기전원리/셀링포인트) */
export interface SubcategoryDetail {
  feature: string | null;
  mechanism: string | null;
  sellingPoints: string[];
  ingredients: IngredientRec[];
  /** 'seed' = 고객 제공 데이터 적재, 'ai_draft' = AI 초안 캐시, 'mock' = 개발용 샘플 */
  source: "seed" | "ai_draft" | "mock";
}
