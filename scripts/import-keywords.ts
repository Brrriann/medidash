/**
 * 네이버 키워드 지표(수요·경쟁·연관어)를 `medidash.keyword_stats`에 적재한다.
 *
 * 수집은 네이버 데이터랩/쇼핑검색 API로 하고, 결과 JSON을 이 스크립트로 넣는다.
 * broadcast_stats와 같은 **월1회 배치 캐시** 패턴이라 앱 런타임은 네이버를 부르지 않는다
 * (Workers 런타임 부담 0, 배포 앱에 네이버 키 불필요).
 *
 * 입력 JSON 형식 (배열):
 *   { "name": "루테인",            // ingredients.name 과 정확히 일치해야 한다 (조회 키)
 *     "term": "루테인",            // 실제 네이버 검색어 (정식명이 아니라 셀러가 치는 말)
 *     "competition": 200185,       // 네이버쇼핑 등록 상품수
 *     "demandVsAnchor": 0.7123,    // 데이터랩 12개월 평균 / 같은 요청의 앵커 평균
 *     "related": [{ "term": "지아잔틴", "count": 8 }] }
 *
 * 앵커 정규화: 데이터랩은 한 요청당 그룹 5개 + 값이 그룹 내 상대값(최대=100)이라 요청끼리
 * 비교가 안 된다. 매 요청에 같은 앵커 키워드를 끼워 넣고 앵커 평균으로 나누면 스케일이
 * 사라져 전 키워드를 하나의 축에 놓을 수 있다. 1.0 초과도 정상(앵커보다 많이 찾는 원료).
 *
 * 사용:
 *   npm run import:keywords -- 파일.json --dry
 *   npm run import:keywords -- 파일.json
 */
import * as fs from "fs";
import { loadEnvFiles } from "../workers/lib/env";
import { createDb } from "../workers/lib/db";

loadEnvFiles();

interface Row {
  name: string;
  term?: string;
  competition: number | null;
  demandVsAnchor: number | null;
  related?: { term: string; count: number }[];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("❌ 입력 파일을 지정하세요: npm run import:keywords -- 파일.json [--dry]");
    process.exit(1);
  }

  const rows: Row[] = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) throw new Error("최상위가 배열이어야 합니다");

  const db = createDb();
  if (!db) {
    console.error("❌ Supabase 키가 없습니다 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  // 사전에 없는 원료명은 조회 키가 안 맞아 화면에서 영영 안 뜬다 → 미리 잡는다
  const { data: ings, error: ingErr } = await db.from("ingredients").select("name");
  if (ingErr) throw new Error(`ingredients 조회 실패: ${ingErr.message}`);
  const known = new Set((ings ?? []).map((i) => i.name));

  const valid: Row[] = [];
  const unknown: string[] = [];
  for (const r of rows) {
    if (!r.name?.trim()) continue;
    if (!known.has(r.name)) unknown.push(r.name);
    else valid.push(r);
  }

  const collectedAt = new Date().toISOString();
  const payload = valid.map((r) => ({
    keyword: r.name,
    kind: "ingredient" as const,
    demand_index: r.demandVsAnchor,
    competition: r.competition,
    related_keywords: r.related ?? [],
    collected_at: collectedAt,
  }));

  console.log(`\n▶ 키워드 지표 적재 ${dry ? "(DRY — 반영 안 함)" : ""}`);
  console.log(`  읽음 ${rows.length}건 · 유효 ${valid.length}건 · 사전에 없는 이름 ${unknown.length}건`);
  if (unknown.length) console.log(`    ⚠️ 건너뜀: ${unknown.join(", ")}`);

  const withDemand = valid.filter((r) => r.demandVsAnchor != null).length;
  const withComp = valid.filter((r) => r.competition != null).length;
  console.log(`  수요 있음 ${withDemand} · 경쟁 있음 ${withComp}`);

  const top = [...valid]
    .filter((r) => r.demandVsAnchor != null)
    .sort((a, b) => b.demandVsAnchor! - a.demandVsAnchor!)
    .slice(0, 5);
  console.log(`  수요 상위: ${top.map((r) => `${r.name}(${r.demandVsAnchor})`).join(" ")}`);

  if (dry) {
    console.log("\n(DRY) 반영하지 않았습니다.\n");
    return;
  }
  if (!payload.length) {
    console.log("\n적재할 행이 없습니다.\n");
    return;
  }

  const { error } = await db.from("keyword_stats").upsert(payload, { onConflict: "keyword,kind" });
  if (error) throw new Error(`적재 실패: ${error.message}`);
  console.log(`\n✅ UPSERT ${payload.length}건 완료\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
