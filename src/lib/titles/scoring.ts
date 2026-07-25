/**
 * 상품명 노출도 스코어링 (docs/UI-PLAN.md §7)
 *
 * 종전엔 "대표원료+부위+브랜드+규격 4요소 중 몇 개 들었나"만 셌다. 그건 상품명 **완성도**지
 * 노출도가 아니다 — 아무도 안 찾는 원료로 4요소를 다 채워도 노출은 안 된다.
 *
 * 그래서 실측 신호를 하나 더 쓴다: **연관 키워드 커버리지**.
 * 네이버쇼핑에서 그 원료로 검색했을 때 **상위에 뜨는 상품들이 실제로 쓰는 단어**를 모아 두고
 * (medidash.keyword_stats.related_keywords), 내 상품명이 그중 몇 %를 담았는지 본다.
 * "지아잔틴·아스타잔틴·눈건강"을 쓰는 시장에서 "루테인"만 적으면 안 걸린다는 걸 잡아낸다.
 *
 * 수요(demand_index)·경쟁(competition)은 **키워드의 속성이지 상품명의 속성이 아니라서**
 * 등급에 섞지 않고 화면에 따로 보여준다. 섞으면 "내가 뭘 고쳐야 등급이 오르는지"가 사라진다.
 */
import type { Exposure } from "./types";

export interface ExposureFactors {
  ingredient: boolean; // 대표원료
  bodyPart: boolean; // 부위/효능
  brand: boolean; // 브랜드
  spec: boolean; // 규격
  /**
   * 상위 노출 상품이 쓰는 연관 키워드 중 이 상품명이 포함한 비율 (0~1).
   * 아직 수집 안 된 키워드거나 mock 모드면 undefined → 종전 방식(요소 개수)으로 폴백.
   */
  relatedCoverage?: number;
}

export function countFactors(f: ExposureFactors): number {
  return [f.ingredient, f.bodyPart, f.brand, f.spec].filter(Boolean).length;
}

/** 연관 키워드 커버리지 → 가점 0~2 */
export function relatedBonus(coverage: number): number {
  if (coverage >= 0.35) return 2;
  if (coverage >= 0.15) return 1;
  return 0;
}

export function scoreExposure(f: ExposureFactors): Exposure {
  const n = countFactors(f);

  // 실측 데이터가 없으면 종전 규칙 그대로 (4개→상 / 3개→중 / 이하→하)
  if (f.relatedCoverage === undefined) {
    return n >= 4 ? "상" : n === 3 ? "중" : "하";
  }

  const score = n + relatedBonus(f.relatedCoverage);
  if (score >= 5) return "상";
  if (score >= 3) return "중";
  return "하";
}

/**
 * 상품명이 연관 키워드를 얼마나 담았는지 (0~1).
 * 검색어 자신(=대표원료)은 어차피 항상 들어가므로 분모에서 뺀다. 안 그러면 점수가 부풀려진다.
 */
export function coverageOf(
  title: string,
  relatedTerms: string[],
  searchTerm: string,
): number | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_·,()[\]/]+/g, "");
  const self = norm(searchTerm);
  const pool = [...new Set(relatedTerms.map(norm))].filter((t) => t && t !== self);
  if (!pool.length) return undefined;
  const hay = norm(title);
  return pool.filter((t) => hay.includes(t)).length / pool.length;
}
