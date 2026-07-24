/**
 * 도매몰 상품 크롤러 워커 (docs/SPEC.md §6.2) — 월 1회 운영 전제.
 *
 * 실행:
 *   npm run crawl                 # 실크롤 (도매몰 계정 + Supabase 키 필요)
 *   npm run crawl -- --dry-run    # 계정·네트워크 없이 파이프라인 검증(픽스처)
 *   npm run crawl -- --source=ggsan --limit=5
 *
 * 매너(§11): 요청 간 2~5초 랜덤 딜레이, 동시성 1, 재시도 2회, 실패는 로그만 남기고 계속.
 * 재실행 시 source_url 기준 중복 없이 upsert(§10).
 */
import type { Browser, Page } from "playwright";
import type {
  CrawlOptions,
  IngredientDict,
  RawProduct,
  WholesaleRecord,
  WholesaleSource,
} from "./lib/types";
import { loadEnvFiles, getCredentials } from "./lib/env";
import { createDb, loadIngredientDict, upsertProducts } from "./lib/db";
import { matchFromFields } from "./lib/ingredient-match";
import { errMsg, politeDelay, runSequential, withRetry } from "./lib/manners";
import { PARSERS, ALL_SOURCES } from "./parsers";
import { SAMPLE_INGREDIENTS } from "../src/lib/data/sample-ingredients";

loadEnvFiles();

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stampAt = new Date().toISOString();
  const sources = opts.onlySource ? [opts.onlySource] : ALL_SOURCES;

  console.log(
    `\n▶ 도매몰 크롤 시작 — ${opts.dryRun ? "DRY-RUN(픽스처)" : "실크롤"} · ` +
      `소스 ${sources.join(", ")} · 소스당 최대 ${opts.limitPerSource}건\n`,
  );

  // 원료 사전: 실모드는 DB, dry-run은 샘플 상수
  const db = opts.dryRun ? null : createDb();
  if (!opts.dryRun && !db) {
    console.error(
      "❌ Supabase 키가 없습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n" +
        "   계정 없이 파이프라인만 보려면: npm run crawl -- --dry-run",
    );
    process.exit(1);
  }
  const dict: IngredientDict[] = db
    ? await loadIngredientDict(db)
    : SAMPLE_INGREDIENTS.map((ing, i) => ({
        id: i + 1,
        name: ing.name,
        aliases: ing.aliases,
      }));
  console.log(`  원료 사전 ${dict.length}종 로드\n`);

  const browserRef: { current: Browser | null } = { current: null };
  const summary: Record<string, { collected: number; matched: number; upserted: number; failed: number }> = {};

  for (const source of sources) {
    const parser = PARSERS[source];
    const stat = { collected: 0, matched: 0, upserted: 0, failed: 0 };
    summary[source] = stat;

    try {
      const raws = opts.dryRun
        ? parser.fixture(opts.limitPerSource)
        : await crawlSourceLive(source, opts, () => ensureBrowser());

      stat.collected = raws.length;

      const records: WholesaleRecord[] = raws.map((raw) => {
        const ingredientIds = matchFromFields([raw.name, raw.detailText], dict);
        if (ingredientIds.length) stat.matched += 1;
        return { ...raw, source, ingredientIds, crawledAt: stampAt };
      });

      if (db) {
        stat.upserted = await upsertProducts(db, records);
      } else {
        // dry-run: upsert 대신 출력
        for (const r of records)
          console.log(
            `    · [${source}] ${r.name}  ₩${r.priceWholesale ?? "?"}  원료매칭 ${r.ingredientIds.length}종`,
          );
      }
      console.log(
        `  ✅ ${parser.label}: 수집 ${stat.collected} · 원료매칭 ${stat.matched} · ` +
          `${db ? `upsert ${stat.upserted}` : "dry-run"}\n`,
      );
    } catch (err) {
      stat.failed += 1;
      console.error(`  ⚠️ ${parser.label} 크롤 실패(서비스 무영향): ${errMsg(err)}\n`);
    }

    if (!opts.dryRun && source !== sources[sources.length - 1]) await politeDelay();
  }

  if (browserRef.current) await browserRef.current.close();

  console.log("──────── 요약 ────────");
  for (const s of sources) {
    const st = summary[s];
    console.log(
      `  ${PARSERS[s].label.padEnd(10)} 수집 ${st.collected} · 매칭 ${st.matched} · ` +
        `${opts.dryRun ? "dry-run" : `upsert ${st.upserted}`}${st.failed ? " · 실패 " + st.failed : ""}`,
    );
  }
  console.log("");

  // ── 실크롤 헬퍼(브라우저 지연 생성) ──
  async function ensureBrowser(): Promise<Browser> {
    if (browserRef.current) return browserRef.current;
    const { chromium } = await import("playwright");
    browserRef.current = await chromium.launch({ headless: true });
    return browserRef.current;
  }
}

/** 실사이트 크롤: 로그인 → 목록 → 상세 순회(매너 적용) */
async function crawlSourceLive(
  source: WholesaleSource,
  opts: CrawlOptions,
  getBrowser: () => Promise<Browser>,
): Promise<RawProduct[]> {
  const parser = PARSERS[source];
  const creds = getCredentials(source);
  if (!creds) {
    console.warn(`  ⏭ ${parser.label}: 계정(env) 없음 — 스킵`);
    return [];
  }

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page: Page = await context.newPage();
  try {
    await withRetry(`${parser.label} 로그인`, () => parser.login(page, creds));
    const urls = await withRetry(`${parser.label} 목록`, () =>
      parser.listProductUrls(page, opts.limitPerSource),
    );
    console.log(`  ${parser.label}: 상세 ${urls.length}건 순회`);

    return await runSequential(
      urls,
      (url) => withRetry(`${parser.label} 상세 ${url}`, () => parser.parseProduct(page, url)),
      { onError: (url, err) => console.warn(`    ✗ ${url}: ${errMsg(err)}`) },
    );
  } finally {
    await context.close();
  }
}

function parseArgs(argv: string[]): CrawlOptions {
  const dryRun = argv.includes("--dry-run");
  const sourceArg = argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  const limitArg = argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const onlySource =
    sourceArg && ALL_SOURCES.includes(sourceArg as WholesaleSource)
      ? (sourceArg as WholesaleSource)
      : undefined;
  return {
    dryRun,
    limitPerSource: limitArg ? Math.max(1, Number(limitArg)) : 10,
    onlySource,
  };
}

main().catch((e) => {
  console.error("❌ 크롤 중단:", errMsg(e));
  process.exit(1);
});
