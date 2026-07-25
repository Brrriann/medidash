/** 상품명·태그 추천 타입 (docs/SPEC.md §6.4 · docs/UI-PLAN.md §7) */
import type { Platform, Exposure } from "@/lib/ai/text";
// 타입만 가져오므로 컴파일 시 사라진다 — 순수 모듈에 서버 코드가 딸려오지 않는다.
import type { KeywordStat } from "@/lib/data";

export type { Platform, Exposure, KeywordStat };

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
  /**
   * 네이버 실측 키워드 지표 (server action이 keyword_stats에서 조회해 주입).
   * 없으면 노출도는 종전 요소 개수 규칙으로 폴백한다.
   */
  keywordStat?: KeywordStat | null;
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
  /** 화면에 수요·경쟁·연관어를 보여주기 위한 원본 지표 (없으면 undefined) */
  keywordStat?: KeywordStat | null;
  /** 추천·채점에 실제로 쓴 연관 어휘 (타사 브랜드·제형어 제외 후) */
  usableRelated?: { term: string; count: number }[];
}
