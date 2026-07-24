/**
 * 상품명·태그 추천 단위 테스트 — 실행: npm test
 * 노출도 스코어링 · 금지어 치환 · 태그 20개 규칙(SPEC §10 인수 기준) 검증.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreExposure } from "../src/lib/titles/scoring";
import { sanitize, hasBannedTerms } from "../src/lib/titles/compliance";
import { generateTitleTags } from "../src/lib/titles/generate";

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
