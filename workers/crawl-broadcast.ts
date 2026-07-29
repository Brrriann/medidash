/**
 * 홈쇼핑모아 방송 지표 크롤러 워커 (docs/SPEC.md §6.3) — 하루 1회 운영.
 *
 * 실행:
 *   npm run crawl:broadcast              # 실크롤 (Supabase 키 필요)
 *   npm run crawl:broadcast -- --dry-run # 파이프라인 검증(픽스처)
 *
 * 자동 실행은 .github/workflows/crawl-broadcast.yml (매일 05:00 KST).
 * **방송 예정(upcoming)이 핵심 산출물이라 월 1회로는 의미가 없다** — 오늘 잡힌 편성을
 * 다음 달에 알려주면 이미 지난 정보다. 원료 87개 × 2~5초 딜레이 ≈ 5분이라 매일 돌려도
 * 상대 사이트에 부담이 되지 않는다.
 *
 * 원료 사전 전체에 대해 홈쇼핑모아 검색 → 방송 지표를 broadcast_stats에 upsert.
 *
 * **브랜드 시드는 넣지 않는다.** 도매몰 상위 브랜드 20개로 실측했더니 홈쇼핑에 잡히는 건
 * 4개뿐이었고(그중 1개는 오탐), 배지가 붙을 상품이 6,003건 중 488건(8.1%)에 그쳤다.
 * 도매몰은 중소·자체 브랜드 위주고 홈쇼핑은 대형 브랜드 무대라 겹치는 구간이 좁다.
 * 대신 **방송 예정(future)** 을 함께 모은다 — "앞으로 뜰 원료"가 셀러에겐 더 쓸모 있다.
 */
import { loadEnvFiles } from "./lib/env";
import { createDb, loadIngredientDict } from "./lib/db";
import { errMsg, politeDelay } from "./lib/manners";
import { SAMPLE_INGREDIENTS } from "../src/lib/data/sample-ingredients";

loadEnvFiles();

/** 방송 1건 — 상품명만 갖고 있던 걸 채널·일시까지 보존하도록 넓혔다 */
export interface BroadcastItem {
  name: string;
  /** 홈쇼핑 채널 코드 (cjmall, gsshop, lotteonetv …) */
  channel: string;
  /** 방송 시작 일시 (ISO) */
  at: string;
}

interface BroadcastStat {
  keyword: string;
  kind: "ingredient" | "brand";
  /** 최근 방송된 상품 수 (hsmoa가 상위 10건만 주므로 상한 10) */
  broadcastCount: number;
  recentTitles: BroadcastItem[];
  /** 방송 **예정** 상품 — 지금 소싱하면 수요 상승기에 올라탈 수 있다는 신호 */
  upcoming: BroadcastItem[];
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
        recentTitles: [
          { name: `[DRYRUN] ${name} 방송 상품 A`, channel: "cjmall", at: "2026-07-25T10:00:00+09:00" },
        ],
        upcoming: [
          { name: `[DRYRUN] ${name} 방송 예정 B`, channel: "gsshop", at: "2026-07-27T20:00:00+09:00" },
        ],
      }))
    : await crawlBroadcastLive(ingredientNames);

  if (db) {
    const rows = stats.map((s) => ({
      keyword: s.keyword,
      kind: s.kind,
      broadcast_count: s.broadcastCount,
      recent_titles: s.recentTitles,
      upcoming: s.upcoming,
      crawled_at: stampAt,
    }));
    const { error } = await db
      .from("broadcast_stats")
      .upsert(rows, { onConflict: "keyword,kind" });
    if (error) throw new Error(`broadcast_stats upsert 실패: ${error.message}`);
    console.log(`  ✅ upsert ${rows.length}건\n`);
  } else {
    for (const s of stats)
      console.log(
        `    · ${s.keyword} — 방송 ${s.broadcastCount}회, 최근 ${s.recentTitles.length}건, 예정 ${s.upcoming.length}건`,
      );
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
  const past = toItems(ag.past);
  return {
    keyword,
    kind: "ingredient",
    broadcastCount: past.length,
    recentTitles: past,
    upcoming: toItems(ag.future),
  };
}

/** hsmoa 항목 배열 → 필요한 필드만. 이름이 없는 건 버린다. */
function toItems(raw: unknown): BroadcastItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: { name?: string; tv_channel?: string; recent_broadcast_start_datetime?: string }) => ({
      name: String(p?.name ?? "").trim(),
      channel: String(p?.tv_channel ?? "").trim(),
      at: String(p?.recent_broadcast_start_datetime ?? "").trim(),
    }))
    .filter((p) => p.name)
    .slice(0, 10);
}

/** 원료 키워드별로 홈쇼핑모아 최근 방송 지표 수집 (매너 딜레이·개별 실패는 로그만). */
async function crawlBroadcastLive(keywords: string[]): Promise<BroadcastStat[]> {
  const out: BroadcastStat[] = [];
  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await politeDelay();
    try {
      const stat = await fetchBroadcastStat(keywords[i]);
      out.push(stat);
      console.log(
        `    · ${stat.keyword} — 방송 ${stat.broadcastCount}건 · 예정 ${stat.upcoming.length}건`,
      );
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
