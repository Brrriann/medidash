/**
 * 크롤러 환경변수 로더 — dotenv 없이 .env.local/.env 로드 (seed.ts와 동일 패턴).
 * 도매몰 계정·Supabase service role 키를 읽고 검증한다.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { WholesaleSource } from "./types";

export function loadEnvFiles(files = [".env.local", ".env"]): void {
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

export interface Credentials {
  id: string;
  pw: string;
}

const CREDENTIAL_ENV: Record<WholesaleSource, [string, string]> = {
  gonyb2b: ["GONYB2B_ID", "GONYB2B_PW"],
  ggsan: ["GGSAN_ID", "GGSAN_PW"],
  upickb2b: ["UPICKB2B_ID", "UPICKB2B_PW"],
};

/** 소스 계정 조회 — 없으면 null (실행부에서 스킵 처리) */
export function getCredentials(source: WholesaleSource): Credentials | null {
  const [idKey, pwKey] = CREDENTIAL_ENV[source];
  const id = process.env[idKey];
  const pw = process.env[pwKey];
  if (!id || !pw) return null;
  return { id, pw };
}

export function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}
