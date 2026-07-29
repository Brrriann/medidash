/**
 * 방송 리드타임 테스트 — 실행: npm test
 *
 * 지키려는 성질 두 가지.
 *  1. 지난 방송은 목록에 남지 않는다 (셀러가 준비할 수 없는 건 보여줄 이유가 없다)
 *  2. 남은 시간이 긴 것이 위로 온다 — 실측 분포상 58%가 "오늘"이라, 반대로 정렬하면
 *     준비 가능한 건들이 전부 화면 밖으로 밀린다
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { leadTime } from "../src/lib/broadcast";

const NOW = Date.parse("2026-07-29T12:00:00+09:00");
const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

test("지난 방송과 못 읽는 일시는 null — 목록에서 빠진다", () => {
  assert.equal(leadTime(at(-0.1), NOW), null);
  assert.equal(leadTime(at(-5), NOW), null);
  assert.equal(leadTime("", NOW), null);
  assert.equal(leadTime("어제쯤", NOW), null);
});

test("라벨은 오늘 → 내일 → n일 남음", () => {
  assert.equal(leadTime(at(0), NOW)?.label, "오늘");
  assert.equal(leadTime(at(0.9), NOW)?.label, "오늘");
  assert.equal(leadTime(at(1), NOW)?.label, "내일");
  assert.equal(leadTime(at(1.9), NOW)?.label, "내일");
  assert.equal(leadTime(at(2), NOW)?.label, "2일 남음");
  // 편성표 상한(열흘)에 가장 가까운 실측값
  assert.equal(leadTime(at(9.8), NOW)?.label, "9일 남음");
});

test("여유도 색은 5일·2일에서 갈린다", () => {
  const tone = (d: number) => leadTime(at(d), NOW)?.tone;
  assert.match(tone(5.1)!, /brand/); // 여유
  assert.match(tone(5)!, /brand/);
  assert.match(tone(4.9)!, /amber/); // 보통
  assert.match(tone(2)!, /amber/);
  assert.match(tone(1.9)!, /slate/); // 임박
  assert.match(tone(0)!, /slate/);
});

test("남은 시간이 긴 순으로 정렬된다 — 화면이 '오늘'로 도배되지 않게", () => {
  const raw = [at(0.2), at(9.8), at(-1), at(3), at(0.5)];
  const sorted = raw
    .map((s) => ({ s, lead: leadTime(s, NOW) }))
    .filter((x): x is typeof x & { lead: NonNullable<typeof x.lead> } => x.lead !== null)
    .sort((a, b) => b.lead.days - a.lead.days)
    .map((x) => x.lead.label);

  assert.deepEqual(sorted, ["9일 남음", "3일 남음", "오늘", "오늘"]);
});
