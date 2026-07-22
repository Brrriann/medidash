/**
 * AI 텍스트 어댑터 (docs/SPEC.md §1·§6.4) — W3에서 provider 구현 교체.
 * AI_TEXT_PROVIDER 환경변수로 anthropic/openai 등을 전환한다.
 */
export type Platform = "coupang" | "smartstore";
export type Exposure = "상" | "중" | "하";

export interface TitleTagsInput {
  ingredient: string;
  symptom?: string;
  productHint?: string;
  platform: Platform;
}

export interface TitleTagsResult {
  /** 상품명 3~5안 + 노출도 등급 (docs/UI-PLAN.md §7 스코어링 규칙) */
  titles: { text: string; exposure: Exposure }[];
  /** 정확히 20개 (증상5·원료5·부위효능5·대상군3·계절2) */
  tags: string[];
}

export interface TextProvider {
  generateTitleTags(input: TitleTagsInput): Promise<TitleTagsResult>;
  /** 4-Tab 패널의 기전/셀링포인트 AI 초안 (금지어 필터 후 subcategory_contents 캐시) */
  generatePanelDraft(input: {
    subcategoryName: string;
    symptom: string;
    tab: "feature" | "mechanism" | "selling";
  }): Promise<string>;
}

export function getTextProvider(): TextProvider {
  const provider = process.env.AI_TEXT_PROVIDER ?? "anthropic";
  // TODO(W3): anthropic / openai 구현 + 금지어 필터(BANNED_TERMS) 적용
  throw new Error(`AI 텍스트 어댑터(${provider})는 W3에서 구현됩니다.`);
}
