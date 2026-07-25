/**
 * 외부 스크래핑 결과(JSON 배열 또는 CSV) → medidash.wholesale_products 적재.
 * 크롤러와 동일 파이프라인(원료 자동매칭 + source_url UPSERT)을 재사용한다.
 *
 * 실행:
 *   npm run import -- <파일.json | 파일.csv>
 *   npm run import -- <파일> --dry     # DB 안 건드리고 파싱·검증만
 *
 * 파일 컬럼(CSV 헤더 또는 JSON 키): source, source_url, name, price_wholesale, image_url, detail
 *   - source: 'upickb2b' | 'ggsan' | 'gonyb2b' (필수)
 *   - source_url: 상품 URL (필수, 중복키)
 *   - name: 상품명 (필수)
 *   - price_wholesale: 숫자 또는 "14,000원" 형태 ('원' 앞 숫자만 취함)
 *   - image_url, detail: 선택
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles } from "../workers/lib/env";
import { createDb, loadIngredientDict, upsertProducts } from "../workers/lib/db";
import { matchFromFields } from "../workers/lib/ingredient-match";
import type { WholesaleRecord, WholesaleSource } from "../workers/lib/types";

loadEnvFiles();

const SOURCES = new Set<string>(["upickb2b", "ggsan", "gonyb2b"]);

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseRows(path: string): Record<string, unknown>[] {
  const raw = readFileSync(path, "utf-8");
  if (path.toLowerCase().endsWith(".json")) {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : (j.products ?? []);
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (cells[i] ?? "").trim()));
    return o;
  });
}

function pick(r: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) if (r[k] != null && r[k] !== "") return String(r[k]);
  return undefined;
}

/** "14,000원53%" 등 → 14000 ('원' 앞 첫 금액, 없으면 전체 숫자). 작업지시서 가격 처리와 동일. */
function toPrice(v: string | undefined): number | null {
  if (!v) return null;
  const won = v.match(/([\d,]+)\s*원/);
  const digits = (won ? won[1] : v).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("사용법: npm run import -- <파일.json | 파일.csv> [--dry]");
    process.exit(1);
  }
  const db = createDb();
  if (!db) {
    console.error("❌ Supabase 키 없음 (.env.local: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }
  const dict = await loadIngredientDict(db);
  const rows = parseRows(resolve(process.cwd(), path));
  const stampAt = new Date().toISOString();

  const records: WholesaleRecord[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const source = pick(r, "source") as WholesaleSource | undefined;
    const sourceUrl = pick(r, "source_url", "sourceUrl");
    const name = pick(r, "name");
    if (!source || !SOURCES.has(source) || !sourceUrl || !name) {
      bad.push(sourceUrl ?? name ?? "(빈 행)");
      continue;
    }
    if (seen.has(sourceUrl)) continue; // 파일 내 중복 URL 제거
    seen.add(sourceUrl);
    const detailText = pick(r, "detail", "detailText") ?? "";
    records.push({
      source,
      sourceUrl,
      name,
      priceWholesale: toPrice(pick(r, "price_wholesale", "priceWholesale")),
      imageUrl: pick(r, "image_url", "imageUrl") ?? null,
      detailText,
      // 상품명만 — 상세는 판매정책 안내문이라 오탐을 만든다 (ingredient-match.ts 주석 참고)
      ingredientIds: matchFromFields([name], dict),
      crawledAt: stampAt,
    });
  }

  const priced = records.filter((r) => r.priceWholesale != null).length;
  const matched = records.filter((r) => r.ingredientIds.length).length;
  console.log(
    `읽음 ${rows.length}행 · 유효 ${records.length}(가격있음 ${priced} · 원료매칭 ${matched}) · 무효 ${bad.length}`,
  );
  if (bad.length) console.log(`  ⚠️ 무효(source/url/name 누락) 예: ${bad.slice(0, 5).join(" | ")}`);
  for (const r of records.slice(0, 3))
    console.log(`  · [${r.source}] ${r.name}  ₩${r.priceWholesale ?? "?"}  원료 ${r.ingredientIds.length}`);

  if (dry) { console.log("\n(--dry: DB 미적재)"); return; }
  if (!records.length) { console.error("적재할 유효 레코드 없음"); process.exit(1); }
  const n = await upsertProducts(db, records);
  console.log(`\n✅ UPSERT ${n}건 완료`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
