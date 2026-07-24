/**
 * 마진 계산 단위 테스트 — 고객 엑셀 "실패없는 마진계산기" 실제 셀 값과 ±0 대조 (SPEC §6.6·§10).
 * 실행: npm test
 *
 * 검증 케이스는 엑셀 3행(판매가 75000, 원가 49000, 지불배송비 3000)에서 추출:
 *   쿠팡6%  : 수수료 7920 · 부가세 1508 · 판매마진 13572 · 종소세 814.32 · 최종마진 12757.68
 *   네이버6%: 수수료 4305.75 · 부가세 1869.425 · 판매마진 16824.825 · 최종마진 15815.3355
 *   쿠팡15% : 종소세 = 판매마진 × 0.15
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMargin, defaultRecommendedPrice } from "../src/lib/margin";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `기대 ${b}, 실제 ${a}`);

test("쿠팡 6% — 엑셀 3행과 ±0 일치", () => {
  const r = calcMargin({
    price: 75000, cost: 49000, customerShipping: 0, paidShipping: 3000,
    packaging: 0, feeRate: 0.096, platform: "coupang", incomeTaxRate: 0.06,
  });
  close(r.fee, 7920); // 75000×(0.096×1.1)
  close(r.vat, 1508); // 7500 − 5992
  close(r.salesMargin, 13572);
  close(r.incomeTax, 814.32);
  close(r.finalMargin, 12757.68);
  close(r.salesMarginRate, 0.18096);
  close(r.finalMarginRate, 0.1701024);
});

test("네이버 6% — 엑셀 3행과 ±0 일치", () => {
  const r = calcMargin({
    price: 75000, cost: 49000, customerShipping: 0, paidShipping: 3000,
    packaging: 0, feeRate: 0.05741, platform: "naver", incomeTaxRate: 0.06,
  });
  close(r.fee, 4305.75); // 75000×0.05741
  close(r.vat, 1869.425);
  close(r.salesMargin, 16824.825);
  close(r.incomeTax, 1009.4895);
  close(r.finalMargin, 15815.3355);
});

test("쿠팡 15% — 종소세율만 15%로 (판매마진 동일, 종소세·최종마진 변화)", () => {
  const r = calcMargin({
    price: 75000, cost: 49000, customerShipping: 0, paidShipping: 3000,
    packaging: 0, feeRate: 0.096, platform: "coupang", incomeTaxRate: 0.15,
  });
  close(r.salesMargin, 13572); // 판매마진은 종소세율과 무관
  close(r.incomeTax, 13572 * 0.15); // 2035.8
  close(r.finalMargin, 13572 - 13572 * 0.15);
});

test("고객배송비(수취)가 있으면 매출·수수료·부가세에 반영", () => {
  const r = calcMargin({
    price: 20000, cost: 8000, customerShipping: 3000, paidShipping: 3000,
    packaging: 500, feeRate: 0.096, platform: "coupang", incomeTaxRate: 0.06,
  });
  // 수수료 = 20000×0.1056 + 3000×0.033 = 2112 + 99 = 2211
  close(r.fee, 2211);
  // 부가세 = (20000+3000)×0.1 − (8000+3000+2211)×0.1 = 2300 − 1321.1 = 978.9
  close(r.vat, 978.9);
  // 판매마진 = 23000 − (8000+3000+500+2211+978.9) = 23000 − 14689.9 = 8310.1
  close(r.salesMargin, 8310.1);
});

test("판매가 0이면 마진율 0 (0 나눗셈 방어)", () => {
  const r = calcMargin({
    price: 0, cost: 0, customerShipping: 0, paidShipping: 0,
    packaging: 0, feeRate: 0.096, platform: "coupang", incomeTaxRate: 0.06,
  });
  assert.equal(r.salesMarginRate, 0);
  assert.equal(r.finalMarginRate, 0);
});

test("소싱 카드 기본 추천가 = 도매가 × 2 (100원 올림)", () => {
  assert.equal(defaultRecommendedPrice(12500), 25000);
  assert.equal(defaultRecommendedPrice(12540), 25100);
});
