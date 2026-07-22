/**
 * 마진 계산 순수 함수 (docs/SPEC.md §6.6 · docs/UI-PLAN.md §8)
 *
 * ⚠️ v1 표준 수식 — 고객 제공 엑셀 수령 시 이 파일의 수식을 1:1로 이식·교체하고
 *    tests/margin.test.ts 를 엑셀 케이스(동일 입력 → ±0원)로 갱신한다 (W3 계약 조건).
 *
 * 수식 (v1):
 *   부가세        = 원가(도매가) × 10%            [UI-PLAN §8]
 *   총원가        = 원가 + 부가세 + 배송비 + 기타비용
 *   플랫폼 수수료 = 판매가 × 수수료율
 *   마진액        = 판매가 − 수수료 − 총원가
 *   마진율(%)     = 마진액 ÷ 판매가 × 100
 *   손익분기 판매가 = 총원가 ÷ (1 − 수수료율)
 *   권장 판매가   = 총원가 ÷ (1 − 수수료율 − 목표마진율)  → 100원 단위 올림
 */

export interface MarginInputs {
  /** 원가(도매가, 원) */
  cost: number;
  /** 판매가(원) */
  price: number;
  /** 플랫폼 수수료율 (%, 예: 스마트스토어 5.5) */
  feeRate: number;
  /** 배송비(판매자 부담, 원) */
  shipping: number;
  /** 기타비용(포장·광고 등, 원) */
  extraCost: number;
}

export interface MarginResults {
  /** 부가세 (원가 × 10%) */
  vat: number;
  /** 총원가 = 원가 + 부가세 + 배송비 + 기타 */
  totalCost: number;
  /** 플랫폼 수수료 = 판매가 × 수수료율 */
  fee: number;
  /** 마진액 */
  margin: number;
  /** 마진율 (%) — 판매가 0이면 0 */
  marginRate: number;
  /** 손익분기 판매가 */
  breakEvenPrice: number;
}

export function calcMargin(inputs: MarginInputs): MarginResults {
  const cost = nonNegative(inputs.cost);
  const price = nonNegative(inputs.price);
  const feeRate = clampRate(inputs.feeRate) / 100;
  const shipping = nonNegative(inputs.shipping);
  const extraCost = nonNegative(inputs.extraCost);

  const vat = Math.round(cost * 0.1);
  const totalCost = cost + vat + shipping + extraCost;
  const fee = Math.round(price * feeRate);
  const margin = price - fee - totalCost;
  const marginRate = price > 0 ? round1((margin / price) * 100) : 0;
  const breakEvenPrice =
    feeRate >= 1 ? Infinity : Math.ceil(totalCost / (1 - feeRate));

  return { vat, totalCost, fee, margin, marginRate, breakEvenPrice };
}

/** 목표 마진율(%)로 권장 판매가 산출 — 100원 단위 올림 (UI-PLAN §8 "판매가 (권장)") */
export function recommendPrice(
  inputs: Omit<MarginInputs, "price">,
  targetMarginRate: number,
): number | null {
  const cost = nonNegative(inputs.cost);
  const feeRate = clampRate(inputs.feeRate) / 100;
  const target = clampRate(targetMarginRate) / 100;
  if (feeRate + target >= 1) return null; // 수수료+목표마진 ≥ 100% — 산출 불가

  const vat = Math.round(cost * 0.1);
  const totalCost =
    cost + vat + nonNegative(inputs.shipping) + nonNegative(inputs.extraCost);
  const raw = totalCost / (1 - feeRate - target);
  return Math.ceil(raw / 100) * 100;
}

/** 소싱 카드의 기본 추천 판매가 — 도매가 × 2 (docs/SPEC.md §5-4, 조정 가능) */
export function defaultRecommendedPrice(cost: number): number {
  return Math.ceil((nonNegative(cost) * 2) / 100) * 100;
}

// ── 내부 ─────────────────────────────────────────────────────

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clampRate(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
