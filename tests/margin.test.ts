/**
 * 마진 계산 단위 테스트 — 실행: npm test
 * ⚠️ 고객 엑셀 수령 시(W3) 엑셀 케이스로 교체·확장한다: 동일 입력 → ±0원 동일 출력이 인수 조건.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcMargin,
  defaultRecommendedPrice,
  recommendPrice,
} from "../src/lib/margin";

test("UI-PLAN §8 예시 입력 — 부가세는 도매가의 10%", () => {
  const r = calcMargin({
    cost: 12_500,
    price: 22_900,
    feeRate: 5.5,
    shipping: 3_000,
    extraCost: 0,
  });
  assert.equal(r.vat, 1_250);
  assert.equal(r.totalCost, 12_500 + 1_250 + 3_000);
  assert.equal(r.fee, Math.round(22_900 * 0.055)); // 1,260
  assert.equal(r.margin, 22_900 - 1_260 - 16_750); // 4,890
  assert.equal(r.marginRate, 21.4);
});

test("손익분기 판매가에서 마진은 0 이상, 100원 아래에선 음수", () => {
  const inputs = { cost: 10_000, feeRate: 10, shipping: 2_500, extraCost: 500 };
  const breakEven = calcMargin({ ...inputs, price: 0 }).breakEvenPrice;
  const atBreakEven = calcMargin({ ...inputs, price: breakEven });
  assert.ok(atBreakEven.margin >= 0);
  const below = calcMargin({ ...inputs, price: breakEven - 100 });
  assert.ok(below.margin < 0);
});

test("권장 판매가는 목표 마진율을 달성한다 (100원 단위 올림)", () => {
  const inputs = { cost: 12_500, feeRate: 5.5, shipping: 3_000, extraCost: 0 };
  const price = recommendPrice(inputs, 30);
  assert.ok(price !== null);
  assert.equal(price % 100, 0);
  const r = calcMargin({ ...inputs, price });
  assert.ok(r.marginRate >= 30, `마진율 ${r.marginRate}% < 목표 30%`);
});

test("수수료율 + 목표마진율이 100% 이상이면 권장가 산출 불가", () => {
  assert.equal(
    recommendPrice({ cost: 10_000, feeRate: 60, shipping: 0, extraCost: 0 }, 45),
    null,
  );
});

test("소싱 카드 기본 추천가 = 도매가 × 2 (100원 올림)", () => {
  assert.equal(defaultRecommendedPrice(12_500), 25_000);
  assert.equal(defaultRecommendedPrice(12_540), 25_100);
});

test("비정상 입력(음수/NaN)은 0으로 처리되어 크래시 없다", () => {
  const r = calcMargin({
    cost: -5,
    price: NaN,
    feeRate: -3,
    shipping: Infinity,
    extraCost: 0,
  });
  assert.equal(r.margin, 0);
  assert.equal(r.marginRate, 0);
});
