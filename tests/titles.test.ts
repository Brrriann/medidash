/**
 * 상품명·태그 추천 단위 테스트 — 실행: npm test
 * 노출도 스코어링 · 금지어 치환 · 태그 20개 규칙(SPEC §10 인수 기준) 검증.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreExposure, coverageOf, relatedBonus } from "../src/lib/titles/scoring";
import { usableRelated, isBrand } from "../src/lib/titles/related";
import { sanitize, hasBannedTerms } from "../src/lib/titles/compliance";
import {
  generateTitleTags,
  scoreExternalTitles,
  mergeTitles,
  mergeTags,
} from "../src/lib/titles/generate";

// ── 노출도 스코어링 (UI-PLAN §7) ──

test("4요소 모두 → 상", () => {
  assert.equal(
    scoreExposure({ ingredient: true, bodyPart: true, brand: true, spec: true }),
    "상",
  );
});
test("3요소 → 중", () => {
  assert.equal(
    scoreExposure({ ingredient: true, bodyPart: true, brand: false, spec: true }),
    "중",
  );
});
test("2요소 이하 → 하", () => {
  assert.equal(
    scoreExposure({ ingredient: true, bodyPart: true, brand: false, spec: false }),
    "하",
  );
});

// ── 연관 키워드 커버리지 (네이버 실측 기반) ──

test("연관 키워드 데이터가 없으면 종전 규칙 그대로 폴백", () => {
  // relatedCoverage undefined → 4요소=상 / 3요소=중 (기존 동작 보존)
  const f = { ingredient: true, bodyPart: true, brand: true, spec: true };
  assert.equal(scoreExposure(f), "상");
  assert.equal(scoreExposure({ ...f, brand: false }), "중");
});

test("연관 키워드를 담으면 등급이 오른다 (요소 2개 기준)", () => {
  const f = { ingredient: true, bodyPart: true, brand: false, spec: false }; // n=2
  assert.equal(scoreExposure({ ...f, relatedCoverage: 0 }), "하"); // 2+0
  assert.equal(scoreExposure({ ...f, relatedCoverage: 0.2 }), "중"); // 2+1
  // 요소가 2개뿐이면 커버리지가 아무리 높아도 상은 안 된다 (2+2=4)
  assert.equal(scoreExposure({ ...f, relatedCoverage: 0.9 }), "중");
});

test("요소 3개 + 높은 커버리지 → 상", () => {
  const f = { ingredient: true, bodyPart: true, brand: false, spec: true }; // n=3
  assert.equal(scoreExposure({ ...f, relatedCoverage: 0.4 }), "상"); // 3+2
  assert.equal(scoreExposure({ ...f, relatedCoverage: 0.2 }), "중"); // 3+1
});

test("4요소를 다 채워도 시장 어휘를 못 담으면 '상'이 아니다", () => {
  // 이게 이번 개편의 핵심 — 종전엔 4요소면 무조건 '상'이었지만,
  // 아무도 안 쓰는 어휘로 채운 상품명은 실제로 노출되지 않는다.
  const full = { ingredient: true, bodyPart: true, brand: true, spec: true }; // n=4
  assert.equal(scoreExposure({ ...full, relatedCoverage: 0.05 }), "중"); // 4+0
  assert.equal(scoreExposure({ ...full, relatedCoverage: 0.2 }), "상"); // 4+1
});

test("relatedBonus 구간", () => {
  assert.equal(relatedBonus(0.14), 0);
  assert.equal(relatedBonus(0.15), 1);
  assert.equal(relatedBonus(0.35), 2);
});

test("coverageOf: 검색어 자신은 분모에서 제외", () => {
  // 연관어 4개 중 검색어(루테인)를 빼면 분모 3, 그중 지아잔틴·눈건강 2개 포함 → 2/3
  const c = coverageOf(
    "종근당 루테인 지아잔틴 눈건강 60캡슐",
    ["루테인", "지아잔틴", "눈건강", "아스타잔틴"],
    "루테인",
  );
  assert.ok(c !== undefined && Math.abs(c - 2 / 3) < 1e-9, `coverage=${c}`);
});

test("coverageOf: 공백·하이픈 무시하고 매칭, 연관어 없으면 undefined", () => {
  assert.equal(coverageOf("오메가-3 rTG 알티지", ["알티지"], "오메가3"), 1);
  assert.equal(coverageOf("루테인 60캡슐", [], "루테인"), undefined);
  // 연관어가 검색어 하나뿐이면 분모가 0이라 undefined (점수 부풀리기 방지)
  assert.equal(coverageOf("루테인 60캡슐", ["루테인"], "루테인"), undefined);
});

// ── 연관 키워드 필터 (타사 브랜드·제형어 제외) ──

test("연관 키워드에서 타사 브랜드·제형어·검색어 자신을 걸러낸다", () => {
  // 네이버 '루테인' 상위 20건 실측 연관어
  const raw = [
    ["지아잔틴", 40], ["아스타잔틴", 32], ["캡슐", 82], ["루테인", 63], ["개월분", 11],
    ["눈건강", 9], ["안국건강", 8], ["뉴트리원", 6], ["GNM", 6], ["종근당", 5],
    ["빌베리", 6], ["알티지", 5], ["프리미엄", 4], ["미니", 10],
  ].map(([term, count]) => ({ term: term as string, count: count as number }));

  const kept = usableRelated(raw, "루테인").map((r) => r.term);

  // 셀러가 실제로 써야 할 어휘는 남는다
  assert.deepEqual(kept, ["지아잔틴", "아스타잔틴", "눈건강", "빌베리", "알티지"]);
  // 상표권 문제가 되는 타사 브랜드는 반드시 빠진다
  for (const b of ["안국건강", "뉴트리원", "GNM", "종근당"]) {
    assert.ok(!kept.includes(b), `브랜드가 추천에 남았다: ${b}`);
  }
  // '눈건강'과 '안국건강'은 빈도가 9 vs 8로 거의 같다 — 빈도만으론 못 가른다는 근거
  assert.ok(kept.includes("눈건강") && !kept.includes("안국건강"));
});

test("isBrand는 대소문자·공백을 무시한다", () => {
  assert.equal(isBrand("종근당"), true);
  assert.equal(isBrand("gnm"), true);
  assert.equal(isBrand("안국 건강"), true);
  assert.equal(isBrand("눈건강"), false);
  assert.equal(isBrand("지아잔틴"), false);
});

test("사전에 없는 브랜드도 작명 패턴으로 잡는다", () => {
  // 사전 나열만으론 새 브랜드를 계속 놓친다 — 접미사·접두사 규칙으로 보완
  for (const b of ["대웅제약", "무슨헬스케어", "어디생활건강", "닥터슈퍼칸", "DrBest"]) {
    assert.equal(isBrand(b), true, `브랜드로 안 잡힘: ${b}`);
  }
  // 원료·효능어는 패턴에 걸리면 안 된다
  for (const ok of ["실리마린", "간건강", "프로바이오틱스", "옥타코사놀"]) {
    assert.equal(isBrand(ok), false, `원료가 브랜드로 잡힘: ${ok}`);
  }
});

test("조사가 붙어 잘린 조각은 버린다", () => {
  // "간에좋은 밀크씨슬"을 토큰화하면 "간에"가 나오는데 상품명에 넣어봐야 검색에 안 걸린다
  const kept = usableRelated(
    [
      { term: "실리마린", count: 9 },
      { term: "간건강", count: 6 },
      { term: "간에", count: 4 },
    ],
    "밀크씨슬",
  ).map((r) => r.term);
  assert.deepEqual(kept, ["실리마린", "간건강"]);
});

// ── 연관어를 상품명에 주입 ──

const LUTEIN_STAT = {
  keyword: "루테인",
  demandIndex: 0.67,
  competition: 200188,
  related: [
    { term: "지아잔틴", count: 12 },
    { term: "아스타잔틴", count: 8 },
    { term: "캡슐", count: 18 },
    { term: "종근당", count: 4 },
  ],
};

test("연관어를 상품명에 넣은 안이 먼저 나오고 등급이 더 높다", () => {
  const r = generateTitleTags({
    ingredient: "루테인", bodyPart: "눈 건강", brand: "그린라이프", spec: "60캡슐",
    platform: "coupang", keywordStat: LUTEIN_STAT,
  });
  // 첫 안에 시장 표준 어휘가 들어가야 셀러가 그대로 써도 노출된다
  assert.ok(r.titles[0].text.includes("지아잔틴"), r.titles[0].text);
  assert.equal(r.titles[0].exposure, "상");
  // 브랜드·제형어는 상품명에 안 들어간다
  assert.ok(!r.titles[0].text.includes("종근당"));
  assert.ok(!r.titles[0].text.includes("캡슐 "));
  // 연관어 없는 안은 같은 4요소여도 등급이 낮다
  const plain = r.titles.find((t) => !t.text.includes("지아잔틴"));
  assert.ok(plain && plain.exposure !== "상", `${plain?.text} ${plain?.exposure}`);
});

test("부위와 연관어가 겹치면 상품명에 중복해 붙지 않는다", () => {
  // bodyPart "간" + 연관어 "간건강" → "… 간건강 간 60캡슐"이 되면 안 된다
  const r = generateTitleTags({
    ingredient: "밀크씨슬", bodyPart: "간", brand: "그린라이프", spec: "60캡슐",
    platform: "coupang",
    keywordStat: {
      keyword: "밀크씨슬 추출물", demandIndex: 0.82, competition: 121416,
      related: [{ term: "실리마린", count: 9 }, { term: "간건강", count: 6 }],
    },
  });
  const first = r.titles[0].text;
  assert.ok(first.includes("간건강"), first);
  assert.ok(!/간건강\s+간(\s|$)/.test(first), `중복 붙음: ${first}`);
});

// ── 금지어 필터 (UI-PLAN §9) ──

test("의약품 오인 금지어 순화 치환", () => {
  const s = sanitize("관절염 치료 완치 예방 효과");
  assert.equal(s.changed, true);
  assert.ok(!hasBannedTerms(s.text), `치환 후에도 금지어 잔존: ${s.text}`);
});
test("금지어 없으면 원문 유지", () => {
  const s = sanitize("눈 건강에 도움을 줄 수 있는 루테인");
  assert.equal(s.changed, false);
});

// ── 생성 결과 (SPEC §6.4 · §10) ──

test("상품명 3~5안 생성 + 각 노출도 등급 부여", () => {
  const r = generateTitleTags({
    ingredient: "루테인 지아잔틴",
    bodyPart: "눈 건강",
    brand: "아이케어",
    spec: "60캡슐",
    platform: "coupang",
  });
  assert.ok(r.titles.length >= 3 && r.titles.length <= 5, `안 개수 ${r.titles.length}`);
  for (const t of r.titles) assert.ok(["상", "중", "하"].includes(t.exposure));
  // 4요소 모두 준 첫 안은 '상'
  assert.equal(r.titles[0].exposure, "상");
});

test("태그는 정확히 20개, 중복 없음", () => {
  const r = generateTitleTags({
    ingredient: "프로바이오틱스",
    bodyPart: "장",
    platform: "smartstore",
  });
  assert.equal(r.tags.length, 20);
  assert.equal(new Set(r.tags).size, 20);
});

test("증상 키워드가 태그에 반영 (taxonomy 연동)", () => {
  const r = generateTitleTags({ ingredient: "루테인", bodyPart: "눈 건강", platform: "coupang" });
  // '눈 건강' 중분류의 증상(눈침침 등) 중 하나 이상 포함
  assert.ok(r.tags.some((t) => ["눈침침", "안구건조", "시력저하", "눈피로", "야맹"].includes(t)));
});

test("플랫폼별 요소 순서 차이 (쿠팡: 브랜드 선두 / 스마트스토어: 원료 선두)", () => {
  const coupang = generateTitleTags({
    ingredient: "홍삼", bodyPart: "면역력", brand: "정관", spec: "30포", platform: "coupang",
  });
  const smart = generateTitleTags({
    ingredient: "홍삼", bodyPart: "면역력", brand: "정관", spec: "30포", platform: "smartstore",
  });
  assert.ok(coupang.titles[0].text.startsWith("정관"), coupang.titles[0].text);
  assert.ok(smart.titles[0].text.startsWith("홍삼"), smart.titles[0].text);
});

test("입력 특징의 금지어는 sanitized 플래그를 세운다", () => {
  const r = generateTitleTags({
    ingredient: "밀크씨슬", bodyPart: "간", productHint: "간질환 예방에 좋음", platform: "coupang",
  });
  assert.equal(r.sanitized, true);
});

// ── AI 제안 병합 (AI는 후보만 내고 채점·금지어는 우리 코드가) ──

test("AI 상품명도 규칙 기반과 같은 잣대로 채점된다", () => {
  const input = {
    ingredient: "루테인", bodyPart: "눈 건강", brand: "그린라이프", spec: "60캡슐",
    platform: "coupang" as const,
  };
  const related = ["지아잔틴", "아스타잔틴", "빌베리"];
  const { variants } = scoreExternalTitles(
    [
      "그린라이프 루테인 지아잔틴 아스타잔틴 눈건강 60캡슐", // 4요소 + 커버리지 2/3
      "루테인 눈건강", // 2요소 + 커버리지 0
    ],
    input,
    related,
  );
  assert.equal(variants[0].exposure, "상");
  assert.equal(variants[1].exposure, "하");
});

test("AI 상품명의 금지어도 치환하고 플래그를 세운다", () => {
  const { variants, sanitized } = scoreExternalTitles(
    ["루테인 눈질환 치료 60캡슐"],
    { ingredient: "루테인", platform: "coupang" as const },
    [],
  );
  assert.equal(sanitized, true);
  assert.ok(!hasBannedTerms(variants[0].text), variants[0].text);
});

test("병합은 중복(띄어쓰기만 다른 안)을 걷어내고 노출도 높은 순 5개", () => {
  const rule = [
    { text: "루테인 눈건강 60캡슐", exposure: "중" as const },
    { text: "루테인 60캡슐", exposure: "하" as const },
  ];
  const ai = [
    { text: "루테인 눈 건강 60캡슐", exposure: "중" as const }, // 띄어쓰기만 다름 → 제거
    { text: "그린라이프 고함량 루테인 지아잔틴 눈영양제 60캡슐", exposure: "상" as const },
    { text: "루테인 빌베리 눈케어 60캡슐", exposure: "중" as const },
  ];
  const merged = mergeTitles(rule, ai);
  assert.ok(merged.length <= 5);
  assert.equal(merged[0].exposure, "상"); // 높은 순 정렬
  assert.equal(merged.filter((m) => m.text.replace(/\s/g, "") === "루테인눈건강60캡슐").length, 1);
});

test("태그 병합: 실측 기반 앞 15개는 지키고 하드코딩 자리를 AI로 채운다", () => {
  const ruleTags = Array.from({ length: 20 }, (_, i) => (i < 15 ? `실측${i}` : `하드코딩${i}`));
  const { tags } = mergeTags(ruleTags, ["눈영양제", "중장년", "고함량"]);
  assert.equal(tags.length, 20);
  assert.equal(new Set(tags).size, 20);
  for (let i = 0; i < 15; i++) assert.equal(tags[i], `실측${i}`);
  assert.deepEqual(tags.slice(15, 18), ["눈영양제", "중장년", "고함량"]);
});

test("태그 병합도 금지어를 치환한다", () => {
  const { tags, sanitized } = mergeTags(["루테인"], ["#질병치료", "눈건강"]);
  assert.equal(sanitized, true);
  assert.ok(!tags.some((t) => hasBannedTerms(t)), tags.join(","));
  // '#'과 공백은 제거된다
  assert.ok(tags.every((t) => !t.startsWith("#") && !/\s/.test(t)));
});
