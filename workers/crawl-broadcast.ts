/**
 * 홈쇼핑모아 방송 지표 크롤러 워커 (docs/SPEC.md §6.3) — 월 1회 운영 전제.
 *
 * 실행:
 *   npm run crawl:broadcast              # 실크롤 (Supabase 키 필요)
 *   npm run crawl:broadcast -- --dry-run # 파이프라인 검증(픽스처)
 *
 * ingredients 전체 + 주요 브랜드 시드에 대해 홈쇼핑모아 검색 →
 * 방송 노출 수·최근 방송 상품명 수집 → broadcast_stats upsert.
 *
 * ⚠️ 골격 단계: 검색/파싱 셀렉터는 계정·실사이트 대조 후 채운다(TODO).
 *    현재는 dry-run 픽스처로 upsert 파이프라인만 검증 가능.
 */
import { loadEnvFiles } from "./lib/env";
import { createDb, loadIngredientDict } from "./lib/db";
import { errMsg } from "./lib/manners";
import { SAMPLE_INGREDIENTS } from "../src/lib/data/sample-ingredients";

loadEnvFiles();

interface BroadcastStat {
  keyword: string;
  kind: "ingredient" | "brand";
  broadcastCount: number;
  recentTitles: string[];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const stampAt = new Date().toISOString();
  console.log(`\n▶ 홈쇼핑모아 지표 크롤 — ${dryRun ? "DRY-RUN(픽스처)" : "실크롤"}\n`);

  const db = dryRun ? null : createDb();
  if (!dryRun && !db) {
    console.error(
      "❌ Supabase 키가 없습니다. 파이프라인만 보려면: npm run crawl:broadcast -- --dry-run",
    );
    process.exit(1);
  }

  // 대상 키워드: 원료(실모드 DB / dry-run 샘플) — 브랜드 시드는 TODO
  const ingredientNames = db
    ? (await loadIngredientDict(db)).map((i) => i.name)
    : SAMPLE_INGREDIENTS.map((i) => i.name);

  const stats: BroadcastStat[] = dryRun
    ? ingredientNames.slice(0, 10).map((name, i) => ({
        keyword: name,
        kind: "ingredient",
        broadcastCount: 5 + i * 3, // 결정적 픽스처
        recentTitles: [`[DRYRUN] ${name} 방송 상품 A`, `[DRYRUN] ${name} 방송 상품 B`],
      }))
    : await crawlBroadcastLive(ingredientNames);

  if (db) {
    const rows = stats.map((s) => ({
      keyword: s.keyword,
      kind: s.kind,
      broadcast_count: s.broadcastCount,
      recent_titles: s.recentTitles,
      crawled_at: stampAt,
    }));
    const { error } = await db
      .from("broadcast_stats")
      .upsert(rows, { onConflict: "keyword,kind" });
    if (error) throw new Error(`broadcast_stats upsert 실패: ${error.message}`);
    console.log(`  ✅ upsert ${rows.length}건\n`);
  } else {
    for (const s of stats)
      console.log(`    · ${s.keyword} — 방송 ${s.broadcastCount}회, 최근 ${s.recentTitles.length}건`);
    console.log(`\n  dry-run: ${stats.length}건 (upsert 생략)\n`);
  }
}

/** ⚠️ TODO: 홈쇼핑모아 검색·파싱 구현 (계정·실사이트 대조 후) */
async function crawlBroadcastLive(keywords: string[]): Promise<BroadcastStat[]> {
  throw new Error(
    `홈쇼핑모아 실크롤(대상 ${keywords.length}종)은 검색/파싱 셀렉터 구현 후 활성화됩니다(W2 후반). 현재는 --dry-run 사용.`,
  );
}

main().catch((e) => {
  console.error("❌ 크롤 중단:", errMsg(e));
  process.exit(1);
});
