import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrice } from "../workers/parsers/shared";

test("parsePrice: 정상 '원' 표기", () => {
  assert.equal(parsePrice("12,500원"), 12500);
  assert.equal(parsePrice("14,500원"), 14500);
});

test("parsePrice: 가격 요소 내 할인율 배지 무시 (첫 '원' 토큰만)", () => {
  // upick(Cafe24) 실제 버그 케이스: "14,000원" + <div class=sale_box>53%</div> → "14,000원53%"
  assert.equal(parsePrice("14,000원53%"), 14000); // 종전엔 1400053으로 오염
  assert.equal(parsePrice("2,900원63%"), 2900);
  assert.equal(parsePrice("14,500원"), 14500); // 할인 배지 없는 경우
});

test("parsePrice: 빈값 / '원' 없으면 전체 숫자 폴백", () => {
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(undefined), null);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("14000"), 14000);
});
