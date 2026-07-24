/**
 * 상품명 노출도 스코어링 (docs/UI-PLAN.md §7)
 * 대표원료 + 부위 + 브랜드 + 규격 4요소 중 포함 개수로 등급 산정.
 *   4개 → 상 · 3개 → 중 · 2개 이하 → 하
 */
import type { Exposure } from "./types";

export interface ExposureFactors {
  ingredient: boolean; // 대표원료
  bodyPart: boolean; // 부위/효능
  brand: boolean; // 브랜드
  spec: boolean; // 규격
}

export function countFactors(f: ExposureFactors): number {
  return [f.ingredient, f.bodyPart, f.brand, f.spec].filter(Boolean).length;
}

export function scoreExposure(f: ExposureFactors): Exposure {
  const n = countFactors(f);
  if (n >= 4) return "상";
  if (n === 3) return "중";
  return "하";
}
