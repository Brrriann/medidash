/**
 * 상품 컨텍스트 조립 테스트 — 실행: npm test
 *
 * 후킹 문구의 재료가 여기서 만들어진다. 원료가 부위·증상으로 되짚어지지 않으면
 * 프롬프트에 "구매자 고민"이 비고, 1장(문제 후킹)이 쓸 내용이 없어진다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductContext } from "../src/lib/products/context";
import type { SubcategoryDetail } from "../src/lib/taxonomy/types";

const rec = (name: string, symptoms: string[]) => ({
  name,
  certificationType: null,
  dailyIntake: null,
  note: null,
  symptoms,
});

const DETAILS: Record<string, SubcategoryDetail> = {
  sleep: {
    feature: null,
    mechanism: null,
    sellingPoints: [],
    source: "seed",
    ingredients: [rec("멜라토닌", ["불면", "잠들기 어려움"]), rec("테아닌", [])],
  },
  joint: {
    feature: null,
    mechanism: null,
    sellingPoints: [],
    source: "seed",
    ingredients: [rec("MSM (디메틸설폰)", ["관절 뻣뻣함"])],
  },
};
const NAMES = { sleep: "수면", joint: "관절·연골" };
const SYMPTOMS = { sleep: ["불면", "얕은잠", "낮졸림"], joint: ["관절 뻣뻣함"] };

const build = (name: string, ingredients: string[]) =>
  buildProductContext({
    name,
    ingredients,
    allIngredientNames: ["멜라토닌", "테아닌", "MSM (디메틸설폰)"],
    details: DETAILS,
    subcategoryNames: NAMES,
    subcategorySymptoms: SYMPTOMS,
  });

test("원료로 부위·증상을 되짚는다", () => {
  const c = build("루아데이 슬리비오 600mg x 30정", ["멜라토닌"]);
  assert.deepEqual(c.bodyParts, ["수면"]);
  assert.deepEqual(c.symptoms, ["불면", "잠들기 어려움"]);
});

test("원료에 증상이 비어 있으면 중분류 증상을 통째로 쓴다", () => {
  // taxonomy/types.ts: symptoms가 비면 "중분류 전체에 해당"이라는 뜻
  const c = build("웰러스 테아닌 450mg x 60캡슐", ["테아닌"]);
  assert.deepEqual(c.symptoms, ["불면", "얕은잠", "낮졸림"]);
});

test("원료가 여러 부위에 걸리면 모두 모은다", () => {
  const c = build("복합 600mg x 60정", ["멜라토닌", "MSM (디메틸설폰)"]);
  assert.deepEqual(c.bodyParts.sort(), ["관절·연골", "수면"]);
  assert.ok(c.symptoms.includes("불면") && c.symptoms.includes("관절 뻣뻣함"));
});

test("매칭된 원료가 없으면 부위·증상이 빈다 (규격은 그대로 나온다)", () => {
  const c = build("내츄럴플러스 프리미엄 루테인 골드 500mg x 60정", []);
  assert.deepEqual(c.bodyParts, []);
  assert.deepEqual(c.symptoms, []);
  assert.equal(c.specText, "500mg · 60정");
});

test("규격·브랜드가 컨텍스트에 실린다", () => {
  const c = build("루아데이 슬리비오 600mg x 30정", ["멜라토닌"]);
  assert.equal(c.spec.brand, "루아데이");
  assert.equal(c.specText, "600mg · 30정");
  assert.equal(c.spec.core, "루아데이 슬리비오");
});

test("증상이 많아도 6개로 자른다 — 프롬프트가 흐려진다", () => {
  const many = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`s${i}`, `증상${i}`]),
  );
  const details: Record<string, SubcategoryDetail> = {
    x: {
      feature: null, mechanism: null, sellingPoints: [], source: "seed",
      ingredients: [rec("멜라토닌", Object.values(many))],
    },
  };
  const c = buildProductContext({
    name: "테스트 600mg x 30정",
    ingredients: ["멜라토닌"],
    allIngredientNames: ["멜라토닌"],
    details,
    subcategoryNames: { x: "테스트부위" },
    subcategorySymptoms: {},
  });
  assert.equal(c.symptoms.length, 6);
});
