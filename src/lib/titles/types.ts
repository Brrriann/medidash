/** 상품명·태그 추천 타입 (docs/SPEC.md §6.4 · docs/UI-PLAN.md §7) */
import type { Platform, Exposure } from "@/lib/ai/text";

export type { Platform, Exposure };

export interface TitleInput {
  /** 대표 원료 (필수) */
  ingredient: string;
  /** 부위/효능 (중분류명 또는 증상, 선택) */
  bodyPart?: string;
  /** 브랜드 (선택) */
  brand?: string;
  /** 규격 (예: 60캡슐, 선택) */
  spec?: string;
  /** 제품 특징 메모 (선택) — 금지어 검사 대상 */
  productHint?: string;
  platform: Platform;
}

export interface TitleVariant {
  text: string;
  exposure: Exposure;
}

export interface TitleTagsResult {
  titles: TitleVariant[];
  /** 정확히 20개 */
  tags: string[];
  /** 입력/출력에서 치환된 금지어가 있었는지 (화면 경고용) */
  sanitized: boolean;
  /** 생성 방식 — 'rule'(규칙 기반, 키 불필요) | 'ai'(어댑터) */
  source: "rule" | "ai";
}
