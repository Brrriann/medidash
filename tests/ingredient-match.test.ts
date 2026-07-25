/**
 * 원료 매칭 단위 테스트 — 실행: npm test
 * 크롤러가 상품명·상세에서 원료를 찾아 ingredient_ids를 채우는 로직의 정확도 검증.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchIngredients, matchFromFields } from "../src/lib/ingredients/match";
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

// ── 정식명 → 핵심어 파생 (실제 도매몰 상품명 기준) ──
// 도매몰은 "밀크씨슬 추출물"이 아니라 "밀크씨슬"로만 적는다. 파생이 없으면 전부 놓쳤다.
const CORE_DICT: IngredientDict[] = [
  { id: 1, name: "밀크씨슬 추출물", aliases: [] },
  { id: 2, name: "쏘팔메토 열매 추출물", aliases: [] },
  { id: 3, name: "바나바잎 추출물", aliases: [] },
  { id: 4, name: "백수오 등 복합추출물", aliases: [] },
  { id: 5, name: "감태 추출물", aliases: [] },
  { id: 6, name: "은행잎 추출물", aliases: [] },
];

test("형태 접미사(추출물)를 뗀 핵심어로 매칭", () => {
  assert.deepEqual(matchIngredients("종근당 밀크씨슬 1000mg x 60정", CORE_DICT), [1]);
  assert.deepEqual(matchIngredients("감태 500mg 수면", CORE_DICT), [5]);
});

test("부위 접미사(열매·잎)까지 뗀 핵심어로 매칭", () => {
  assert.deepEqual(matchIngredients("쏘팔메토 1000mg 남성", CORE_DICT), [2]);
  assert.deepEqual(matchIngredients("바나바 코로솔산 정", CORE_DICT), [3]);
});

test("'등 복합추출물'도 핵심어로 축약", () => {
  assert.deepEqual(matchIngredients("백수오 갱년기 60캡슐", CORE_DICT), [4]);
});

test("2자 일반어로 축약되는 파생은 버린다 (은행잎 → '은행' 오탐 방지)", () => {
  // "은행"만 있는 텍스트는 매칭되면 안 되고, "은행잎"은 매칭돼야 한다
  assert.deepEqual(matchIngredients("은행 이자 안내", CORE_DICT), []);
  assert.deepEqual(matchIngredients("은행잎추출물 징코 60정", CORE_DICT), [6]);
});

test("파생이 서로 다른 원료를 잡아먹지 않는다", () => {
  // 쏘팔메토 상품이 밀크씨슬·바나바로도 잡히면 안 됨
  assert.deepEqual(matchIngredients("쏘팔메토 옥타코사놀 320mg", CORE_DICT), [2]);
});
