/** 모든 AI 산출 화면 하단에 노출하는 고지 문구 (docs/SPEC.md §6.4) */
export const AI_DISCLAIMER =
  "AI 초안입니다. 건강기능식품 표시·광고 규정 검수 후 사용하세요.";

/** 콘텐츠(원료·셀링포인트) 화면 공통 고지 */
export const COMPLIANCE_NOTICE =
  "본 정보는 판매 참고용 초안이며 질병의 예방·치료 효능을 보장하지 않습니다. 표시·광고 규정 검수 후 사용하세요.";

/**
 * 의약품 오인 우려 금지어 → 노출 문구에서 "도움을 줄 수 있음" 계열로 치환 (docs/UI-PLAN.md §9)
 * W3 상품명·태그 API의 코드 레벨 필터에서 사용.
 */
export const BANNED_TERMS = [
  "치료",
  "완치",
  "치유",
  "예방",
  "약효",
  "처방",
  "질병이 낫",
  "병이 낫",
  "항암",
  "면역력 강화 보장",
] as const;

export const SAFE_PHRASE_SUFFIX = "에 도움을 줄 수 있음";

/** 4-Tab 상세 패널 탭 정의 (docs/UI-PLAN.md §5) */
export const DETAIL_TABS = [
  { key: "feature", label: "특징" },
  { key: "ingredients", label: "추천원료" },
  { key: "mechanism", label: "기전원리" },
  { key: "selling", label: "셀링포인트" },
] as const;

export type DetailTabKey = (typeof DETAIL_TABS)[number]["key"];

/** 썸네일 사이즈 프리셋 (W3 썸네일 스튜디오) */
export const THUMBNAIL_PRESETS = [
  { key: "coupang", label: "쿠팡 정방형", width: 1000, height: 1000 },
  { key: "smartstore", label: "스마트스토어", width: 1000, height: 1000 },
  { key: "instagram", label: "인스타", width: 1080, height: 1080 },
] as const;

/** 도매몰 소스 (docs/SPEC.md §6.2) */
export const WHOLESALE_SOURCES = [
  { key: "gonyb2b", label: "건온연B2B", url: "https://gonyb2b.com" },
  { key: "ggsan", label: "건강산", url: "https://www.ggsan.com" },
  { key: "upickb2b", label: "유픽B2B", url: "https://upickb2b.com" },
] as const;
