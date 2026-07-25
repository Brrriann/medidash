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
import { errMsg, politeDelay } from "./lib/manners";
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

const HSMOA_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 홈쇼핑모아(hsmoa.com) 검색 페이지의 __NEXT_DATA__(SSR JSON)에서 최근 방송 지표를 뽑는다.
 * 공개 사이트(로그인 불필요). aggregatedData.past = 최근 방송된 상품들(사이트가 상위 10건 제공).
 * ponytail: broadcastCount는 "최근 방송 상품 수(≤10)" 신호 — 사이트가 총계를 안 주므로 상한 존재.
 */
/** 원료 정식명 → 홈쇼핑모아 상품검색에 잘 맞는 핵심어 (괄호·복합·추출물 표기 제거). */
function toSearchTerm(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, "") // "MSM (디메틸설폰)" → "MSM"
    .replace(/\s*등\s*복합\s*추출물/g, "") // "백수오 등 복합추출물" → "백수오"
    .replace(/\s*추출물\s*$/g, "") // "밀크씨슬 추출물" → "밀크씨슬"
    .trim();
}

async function fetchBroadcastStat(keyword: string): Promise<BroadcastStat> {
  // keyword(원료 정식명)는 broadcast_stats 조인용으로 보존, 검색만 핵심어로.
  const url = `https://hsmoa.com/search?query=${encodeURIComponent(toSearchTerm(keyword))}`;
  const res = await fetch(url, { headers: { "User-Agent": HSMOA_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("__NEXT_DATA__ 없음 (사이트 구조 변경?)");
  const ag = JSON.parse(m[1])?.props?.pageProps?.aggregatedData ?? {};
  const past: Array<{ name?: string }> = Array.isArray(ag.past) ? ag.past : [];
  const recentTitles = past
    .map((p) => String(p?.name ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
  return { keyword, kind: "ingredient", broadcastCount: past.length, recentTitles };
}

/** 원료 키워드별로 홈쇼핑모아 최근 방송 지표 수집 (매너 딜레이·개별 실패는 로그만). */
async function crawlBroadcastLive(keywords: string[]): Promise<BroadcastStat[]> {
  const out: BroadcastStat[] = [];
  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await politeDelay();
    try {
      const stat = await fetchBroadcastStat(keywords[i]);
      out.push(stat);
      console.log(`    · ${stat.keyword} — 방송 ${stat.broadcastCount}건 · 최근 ${stat.recentTitles.length}`);
    } catch (err) {
      console.warn(`    ✗ ${keywords[i]}: ${errMsg(err)}`);
    }
  }
  return out;
}

main().catch((e) => {
  console.error("❌ 크롤 중단:", errMsg(e));
  process.exit(1);
});
