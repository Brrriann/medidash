/**
 * mock 모드 판정 테스트 — 설정 누락이 프로덕션에서 "인증 없는 공개 사이트"가 되지 않는지.
 * 실행: npm test
 *
 * isMockMode()가 true를 주면 미들웨어·AI 라우트·서버 액션이 전부 인증을 건너뛴다.
 * 그 판단이 프로덕션에서 절대 나오면 안 된다는 것이 여기서 지키려는 유일한 성질이다.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isMockMode, supabaseConfigured } from "../src/lib/supabase/env";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NODE_ENV",
] as const;
/** next-env.d.ts가 NODE_ENV를 readonly로 좁혀둬서, 테스트에서만 쓰는 쓰기 가능한 핸들 */
const env = process.env as Record<string, string | undefined>;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, env[k]]));

function setEnv(url?: string, anon?: string, nodeEnv?: string) {
  for (const [k, v] of [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anon],
    ["NODE_ENV", nodeEnv],
  ] as const) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
});

test("키가 다 있으면 mock 아님 (환경 무관)", () => {
  setEnv("https://x.supabase.co", "anon-key", "production");
  assert.equal(supabaseConfigured(), true);
  assert.equal(isMockMode(), false);
});

test("개발에서 키가 없으면 mock 모드", () => {
  setEnv(undefined, undefined, "development");
  assert.equal(isMockMode(), true);
});

test("프로덕션에서 키가 없으면 mock으로 떨어지지 않고 던진다", () => {
  setEnv(undefined, undefined, "production");
  assert.throws(() => isMockMode(), /환경변수/);
});

test("프로덕션에서 키가 하나만 있어도 던진다 (반쪽 설정이 실제 사고 경로)", () => {
  setEnv("https://x.supabase.co", undefined, "production");
  assert.throws(() => isMockMode(), /환경변수/);
  setEnv(undefined, "anon-key", "production");
  assert.throws(() => isMockMode(), /환경변수/);
});

test("프로덕션에서 빈 문자열은 미설정과 같게 취급한다", () => {
  setEnv("", "", "production");
  assert.throws(() => isMockMode(), /환경변수/);
});
