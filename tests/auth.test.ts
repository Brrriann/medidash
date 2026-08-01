/**
 * 로그인 후 복귀 경로 테스트 — 실행: npm test
 *
 * 지키려는 성질 하나: **소셜 콜백이 외부 사이트로 사용자를 보내지 않는다.**
 * `?next=`는 공격자가 링크에 심을 수 있는 값이라, 여기가 뚫리면 우리 도메인을 거쳐
 * 피싱 페이지로 보내는 통로가 된다(오픈 리다이렉트).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, SOCIAL_PROVIDERS } from "../src/lib/auth";

test("내부 경로는 그대로 통과", () => {
  assert.equal(safeNext("/studio"), "/studio");
  assert.equal(safeNext("/sourcing?q=루테인"), "/sourcing?q=루테인");
  assert.equal(safeNext("/"), "/");
});

test("외부로 나가는 값은 전부 / 로 떨어진다", () => {
  // 프로토콜 상대 URL — 브라우저가 //evil.com을 https://evil.com으로 읽는다
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("http://evil.com"), "/");
  assert.equal(safeNext("evil.com"), "/");
});

test("빈 값·누락도 / 로 떨어진다", () => {
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(undefined), "/");
  assert.equal(safeNext(""), "/");
});

test("제공자 목록에는 Supabase 기본 제공자만 있다", () => {
  // 네이버(custom:naver)는 동작 확인 전까지 넣지 않는다 — 버튼만 있고 안 되면 더 나쁘다
  assert.deepEqual([...SOCIAL_PROVIDERS], ["google", "kakao"]);
});
