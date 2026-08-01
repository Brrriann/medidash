/**
 * 운영 프로필 테스트 — 실행: npm test
 *
 * jsonb에서 읽은 값이 그대로 CS 답변 프롬프트로 들어간다. 형이 깨진 값이 통과하면
 * 프롬프트가 망가지거나(예: channels가 문자열) 서버에서 터진다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toOpsProfile,
  isOpsProfileReady,
  missingOpsFields,
  EMPTY_OPS_PROFILE,
} from "../src/lib/ops-profile";

test("빈 값·null도 안전하게 읽는다", () => {
  assert.deepEqual(toOpsProfile(null), EMPTY_OPS_PROFILE);
  assert.deepEqual(toOpsProfile(undefined), EMPTY_OPS_PROFILE);
  assert.deepEqual(toOpsProfile({}), EMPTY_OPS_PROFILE);
});

test("형이 깨진 값은 걸러낸다", () => {
  const p = toOpsProfile({
    brandName: 123,          // 문자열이 아님
    channels: "쿠팡",         // 배열이 아님
    shipping: "  당일 출고  ", // 공백 제거
  });
  assert.equal(p.brandName, "");
  assert.deepEqual(p.channels, []);
  assert.equal(p.shipping, "당일 출고");
});

test("채널은 platform·storeName 중 하나라도 있어야 남는다", () => {
  const p = toOpsProfile({
    channels: [
      { platform: "쿠팡", storeName: "헬스몰", url: "https://x" },
      { platform: "", storeName: "", url: "https://y" }, // 이름이 없으면 쓸모없다
      { storeName: "네이버스토어" },
    ],
  });
  assert.equal(p.channels.length, 2);
  assert.deepEqual(p.channels[0], {
    platform: "쿠팡",
    storeName: "헬스몰",
    url: "https://x",
  });
  assert.equal(p.channels[1].platform, "");
});

test("카테고리는 비면 건강기능식품으로 채운다", () => {
  assert.equal(toOpsProfile({}).category, "건강기능식품");
  assert.equal(toOpsProfile({ category: "화장품" }).category, "화장품");
});

test("상호명과 배송 정책이 있어야 CS 답변을 만들 수 있다", () => {
  const base = toOpsProfile({ brandName: "헬스몰", shipping: "당일 출고" });
  assert.equal(isOpsProfileReady(base), true);
  assert.deepEqual(missingOpsFields(base), []);

  assert.equal(isOpsProfileReady(toOpsProfile({ brandName: "헬스몰" })), false);
  assert.deepEqual(missingOpsFields(toOpsProfile({ shipping: "당일" })), ["브랜드/상호명"]);
  assert.deepEqual(missingOpsFields(toOpsProfile({})), ["브랜드/상호명", "배송 정책"]);
});
