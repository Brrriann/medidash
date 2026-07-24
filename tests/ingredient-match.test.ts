/**
 * 원료 매칭 단위 테스트 — 실행: npm test
 * 크롤러가 상품명·상세에서 원료를 찾아 ingredient_ids를 채우는 로직의 정확도 검증.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchIngredients, matchFromFields } from "../workers/lib/ingredient-match";
import type { IngredientDict } from "../workers/lib/types";

const DICT: IngredientDict[] = [
  { id: 1, name: "루테인", aliases: ["lutein", "마리골드꽃추출물"] },
  { id: 2, name: "밀크씨슬 추출물", aliases: ["milk thistle", "실리마린"] },
  { id: 3, name: "프로바이오틱스", aliases: ["probiotics", "유산균"] },
  { id: 4, name: "오메가3 (EPA·DHA)", aliases: ["omega3", "EPA", "DHA"] },
];

test("상품명에서 원료명 직접 매칭", () => {
  assert.deepEqual(matchIngredients("루테인 지아잔틴 60캡슐", DICT), [1]);
});

test("영문 별칭 매칭 (대소문자·공백 무시)", () => {
  assert.deepEqual(matchIngredients("Premium LUTEIN eye care", DICT), [1]);
});

test("상세 텍스트에서 한글 별칭 매칭", () => {
  assert.deepEqual(
    matchIngredients("고함량 실리마린 130mg 간건강", DICT),
    [2],
  );
});

test("여러 원료 동시 매칭 — 사전 순서 유지", () => {
  const text = "유산균 100억 + 오메가3 rTG 복합";
  assert.deepEqual(matchIngredients(text, DICT), [3, 4]);
});

test("매칭 없으면 빈 배열", () => {
  assert.deepEqual(matchIngredients("비타민C 1000 아스코르브산", DICT), []);
});

test("상품명 + 상세 필드 합산 매칭, 중복 id 제거", () => {
  const ids = matchFromFields(
    ["오메가3 캡슐", "EPA DHA 1000mg omega3", null],
    DICT,
  );
  assert.deepEqual(ids, [4]); // 여러 별칭이 맞아도 id는 하나
});

test("구분자(·, 괄호 등) 섞인 표기도 정규화 후 매칭", () => {
  assert.deepEqual(matchIngredients("오메가-3 (EPA/DHA)", DICT), [4]);
});
