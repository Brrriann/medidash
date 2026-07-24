/**
 * 마진 계산 — 고객 제공 엑셀 "세금 제외되는 실패없는 마진계산기" 수식 1:1 이식.
 * (docs/SPEC.md §6.6 — 동일 입력 시 엑셀과 동일 출력 ±0원)
 *
 * 엑셀 열 매핑:
 *   G 판매가 · H 상품원가 · I 고객배송비(수취) · J 지불배송비 · K 포장비용 · L 수수료율
 *   M 수수료(원) · N 부가세(순) · O 종소세 · P 판매마진 · Q 판매마진율 · R 최종마진 · S 최종마진율
 *
 * 플랫폼 차이:
 *   쿠팡  M = 판매가×(수수료율×1.1) + 고객배송비×3.3%   (카테고리 수수료율은 VAT 별도 → ×1.1)
 *   네이버 M = 판매가×수수료율      + 고객배송비×3.63%  (수수료율은 VAT 포함)
 *
 * ⚠️ 엑셀과 동일하게 중간값을 반올림하지 않는다(부동소수 그대로). 반올림은 표시 단계에서만.
 */

export type MarginPlatform = "coupang" | "naver";

/** 쿠팡: 카테고리 수수료 3.3%, 네이버: 3.63% (고객배송비에 부과되는 수수료율) */
const SHIPPING_FEE_RATE: Record<MarginPlatform, number> = {
  coupang: 0.033,
  naver: 0.0363,
};

export interface MarginInputs {
  /** G 판매가(원) */
  price: number;
  /** H 상품원가(도매가, 원) */
  cost: number;
  /** I 고객배송비 — 고객에게 받는 배송비(매출) */
  customerShipping: number;
  /** J 지불배송비 — 판매자가 지불하는 배송비(비용) */
  paidShipping: number;
  /** K 포장비용 */
  packaging: number;
  /** L 수수료율 (소수. 쿠팡=카테고리율 VAT별도, 네이버=총율 VAT포함) */
  feeRate: number;
  platform: MarginPlatform;
  /** 종합소득세율 (소수, 예: 0.06 · 0.15) */
  incomeTaxRate: number;
}

export interface MarginResults {
  /** M 수수료(원) */
  fee: number;
  /** N 부가세(순 = 매출VAT − 매입VAT, 음수 가능) */
  vat: number;
  /** O 종합소득세 */
  incomeTax: number;
  /** P 판매마진 (종소세 차감 전) */
  salesMargin: number;
  /** Q 판매마진율 */
  salesMarginRate: number;
  /** R 최종마진 (종소세 차감 후) */
  finalMargin: number;
  /** S 최종마진율 */
  finalMarginRate: number;
}

export function calcMargin(inp: MarginInputs): MarginResults {
  const price = num(inp.price);
  const cost = num(inp.cost);
  const custShip = num(inp.customerShipping);
  const paidShip = num(inp.paidShipping);
  const packaging = num(inp.packaging);
  const feeRate = num(inp.feeRate);
  const taxRate = num(inp.incomeTaxRate);

  // M 수수료(원) — 플랫폼별
  const fee =
    inp.platform === "coupang"
      ? price * (feeRate * 1.1) + custShip * SHIPPING_FEE_RATE.coupang
      : price * feeRate + custShip * SHIPPING_FEE_RATE.naver;

  // N 부가세(순) = 매출VAT − 매입VAT
  const vat = (price + custShip) * 0.1 - (cost + paidShip + fee) * 0.1;

  // P 판매마진
  const salesMargin = price + custShip - (cost + paidShip + packaging + fee + vat);

  // O 종소세 · R 최종마진
  const incomeTax = salesMargin * taxRate;
  const finalMargin = salesMargin - incomeTax;

  return {
    fee,
    vat,
    incomeTax,
    salesMargin,
    salesMarginRate: price > 0 ? salesMargin / price : 0,
    finalMargin,
    finalMarginRate: price > 0 ? finalMargin / price : 0,
  };
}

/** 소싱 카드의 기본 추천 판매가 — 도매가 × 2 (docs/SPEC.md §5-4, 조정 가능) */
export function defaultRecommendedPrice(cost: number): number {
  return Math.ceil((num(cost) * 2) / 100) * 100;
}

// ── 수수료 프리셋 (오픈마켓 수수료 시트) ──────────────────────

/** 쿠팡 카테고리 수수료율 (VAT 별도 — 계산 시 ×1.1) */
export const COUPANG_FEE_PRESETS: { label: string; rate: number }[] = [
  { label: "뷰티/헬스", rate: 0.096 },
  { label: "식품", rate: 0.106 },
  { label: "출산/유아", rate: 0.1 },
  { label: "생활용품", rate: 0.078 },
  { label: "가전/디지털", rate: 0.078 },
  { label: "주방/스포츠/패션", rate: 0.108 },
];

/** 네이버(스마트스토어) 총수수료 = 주문관리(VAT포함) + 판매연동 2% */
export const NAVER_FEE_PRESETS: { label: string; rate: number }[] = [
  { label: "일반(신용카드)", rate: 0.0574 }, // 3.74% + 2%
  { label: "영세(~3억)", rate: 0.0398 }, // 1.98% + 2%
  { label: "중소1(3~5억)", rate: 0.04585 }, // 2.585% + 2%
  { label: "중소2(5~10억)", rate: 0.0475 }, // 2.75% + 2%
  { label: "중소3(10~30억)", rate: 0.05025 }, // 3.025% + 2%
];

/** 종합소득세율 옵션 (엑셀 6% · 15% + 상위 구간) */
export const INCOME_TAX_PRESETS: { label: string; rate: number }[] = [
  { label: "6% (~1,400만)", rate: 0.06 },
  { label: "15% (~5,000만)", rate: 0.15 },
  { label: "24% (~8,800만)", rate: 0.24 },
];

function num(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
