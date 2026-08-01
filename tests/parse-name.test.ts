/**
 * 상품명 파서 테스트 — 실행: npm test
 *
 * 입력은 전부 **프로덕션 DB에서 그대로 가져온 실제 상품명**이다. 도매몰 표기가 제각각이라
 * (공백 유무·천단위 쉼표·세트 표기·판매 태그) 만들어낸 예시로는 깨지는 지점을 못 잡는다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProductName, specLine } from "../src/lib/products/parse-name";

const INGREDIENTS = ["프로바이오틱스", "비타민C", "루테인", "MSM", "코큐텐", "밀크씨슬"];
const p = (n: string) => parseProductName(n, INGREDIENTS);

test("기본형 — 브랜드·함량·수량·제형을 모두 뽑는다", () => {
  const s = p("라이프플러스 삼백초 맥문동 정 600mg x 60정");
  assert.equal(s.brand, "라이프플러스");
  assert.equal(s.mgPerUnit, 600);
  assert.equal(s.unitCount, 60);
  assert.equal(s.form, "정");
  assert.equal(s.packCount, 1);
});

test("x 앞뒤 공백이 없어도 읽는다", () => {
  const s = p("웰러스 바른 비타민D 450mg x90캡슐");
  assert.equal(s.mgPerUnit, 450);
  assert.equal(s.unitCount, 90);
  assert.equal(s.form, "캡슐");
});

test("천단위 쉼표를 숫자로 읽는다", () => {
  assert.equal(p("내츄럴플러스 리포좀 영국산 비타민C 500 1,100mg x 60정").mgPerUnit, 1100);
});

test("g·ml는 mg로 환산한다", () => {
  assert.equal(p("웰러스 비타민C 500 2g x 20포").mgPerUnit, 2000);
  assert.equal(p("헬씨허그 눈꽃 차전자피&다이어트S 9g x 28포").mgPerUnit, 9000);
  assert.equal(p("헬씨허그 마이라이프 엑스트라버진 유기농 올리브오일 100% 10ml x 30포").mgPerUnit, 10000);
});

test("세트 구성 개수를 뽑는다", () => {
  assert.equal(p("웰러스 리포좀 비타민C 세트 1100mg x 60정 x 2개입").packCount, 2);
  assert.equal(p("헬씨허그 애니타임 홍삼필름(세트) 211mg x 20매x 3개").packCount, 3);
});

test("(10개월) 표기는 개월분으로, 판매 태그는 core에서 빠진다", () => {
  const s = p("(10개월) 밀크씨슬은 간에 좋은 헤파씨슬 400mg x 300캡슐");
  assert.equal(s.monthsSupply, 10);
  assert.equal(s.unitCount, 300);
  assert.ok(!s.core.includes("10개월"), "core에 태그가 남으면 안 된다");
});

test("판매 태그는 tags로 분리되고 후킹 문구용 core에는 안 남는다", () => {
  const s = p("[소비기한임박할인] 순수한줌 베타인 NMN 정 600mg x 60정");
  assert.deepEqual(s.tags, ["[소비기한임박할인]"]);
  assert.ok(!s.core.includes("소비기한"), `core=${s.core}`);
  assert.equal(s.brand, "순수한줌");

  const s2 = p("네이처그랜드 엔쵸비 오메가3 플러스D 1002mg x 360캡슐 (쿠팡 등록 불가)");
  assert.ok(!s2.core.includes("쿠팡"), `core=${s2.core}`);
});

test("브랜드 없는 상품명은 brand=null", () => {
  // 첫 어절이 원료명이면 브랜드로 보지 않는다
  assert.equal(p("루테인플러스&아스타잔틴 500mg x 60캡슐").brand, null);
  // 첫 어절이 너무 길면(문장형) 브랜드가 아니다
  assert.equal(p("지방 탄수화물 단백질대사는 에스핏다이어트앤유산균 450mg x 300캡슐").brand, null);
});

test("규격이 없는 상품명도 죽지 않는다", () => {
  const s = p("굿바이 스트레스");
  assert.equal(s.mgPerUnit, null);
  assert.equal(s.unitCount, null);
  assert.equal(s.form, null);
  assert.equal(s.core, "굿바이 스트레스");
});

test("specLine — 값이 있는 것만 이어 붙인다", () => {
  assert.equal(
    specLine(p("(10개월) 밀크씨슬은 간에 좋은 헤파씨슬 400mg x 300캡슐")),
    "400mg · 300캡슐 · 10개월분",
  );
  assert.equal(specLine(p("헬씨허그 애니타임 홍삼필름(세트) 211mg x 20매x 3개")), "211mg · 20매 · 3개 세트");
  assert.equal(specLine(p("굿바이 스트레스")), "");
});
