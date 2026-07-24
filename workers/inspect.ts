/**
 * 도매몰 파서 셀렉터 실측용 페이지 캡처 도구 (로컬 실행 전용).
 *
 * 이 프로젝트의 클라우드 개발환경은 도매몰 사이트 접속이 막혀 있어, 파서 셀렉터를
 * 실측할 수 없다. 셀러 본인 PC(네트워크 열림)에서 이 도구로 로그인/목록/상세 페이지의
 * HTML·스크린샷을 저장한 뒤, 그 파일을 개발자에게 전달하면 정확한 셀렉터를 채울 수 있다.
 *
 * 실행 (로컬):
 *   npm run crawl:inspect -- --source=upickb2b                      # 1) 로그인 페이지 캡처 (계정 불필요)
 *   npm run crawl:inspect -- --source=upickb2b --url=<로그인URL>     #    로그인 경로가 다르면 지정
 *   npm run crawl:inspect -- --source=upickb2b --login              # 2) 로그인 후 목록 페이지 캡처
 *   npm run crawl:inspect -- --source=upickb2b --login --url=<상세URL>  # 3) 상세 페이지 캡처
 *
 * 출력: workers/.inspect/<source>-<n>.html / .png  (gitignore됨)
 */
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles, getCredentials } from "./lib/env";
import { errMsg } from "./lib/manners";
import { PARSERS, ALL_SOURCES } from "./parsers";
import type { WholesaleSource } from "./lib/types";

loadEnvFiles();

const OUT_DIR = resolve(process.cwd(), "workers/.inspect");

async function main() {
  const argv = process.argv.slice(2);
  const source = argv.find((a) => a.startsWith("--source="))?.split("=")[1] as
    | WholesaleSource
    | undefined;
  const url = argv.find((a) => a.startsWith("--url="))?.split("=")[1];
  const doLogin = argv.includes("--login");

  if (!source || !ALL_SOURCES.includes(source)) {
    console.error(`❌ --source= 필요 (${ALL_SOURCES.join(" | ")})`);
    process.exit(1);
  }
  const parser = PARSERS[source];
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (doLogin) {
      const creds = getCredentials(source);
      if (!creds) throw new Error(`${parser.label} 계정(env)이 없습니다.`);
      console.log(`  ${parser.label} 로그인 시도…`);
      await parser.login(page, creds);
      console.log("  ✅ 로그인 성공 (또는 로그인 절차 통과)");
    }

    const target = url ?? parser.baseUrl;
    console.log(`  이동: ${target}`);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    const n = nextIndex(source);
    const base = resolve(OUT_DIR, `${source}-${n}`);
    const html = await page.content();
    writeFileSync(`${base}.html`, html, "utf-8");
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    console.log(`\n✅ 저장:\n   ${base}.html\n   ${base}.png\n`);
    console.log("이 두 파일(특히 .html)을 개발자에게 전달하면 셀렉터를 채웁니다.");
  } catch (err) {
    console.error(`❌ 캡처 실패: ${errMsg(err)}`);
    console.error("   (로그인 단계라면, 아직 셀렉터가 플레이스홀더라 실패가 정상입니다 →");
    console.error("    먼저 --login 없이 로그인 페이지부터 캡처해 주세요.)");
  } finally {
    await browser.close();
  }
}

function nextIndex(source: string): number {
  try {
    const used = readdirSync(OUT_DIR)
      .filter((f) => f.startsWith(`${source}-`) && f.endsWith(".html"))
      .map((f) => Number(f.replace(`${source}-`, "").replace(".html", "")))
      .filter((n) => Number.isFinite(n));
    return used.length ? Math.max(...used) + 1 : 1;
  } catch {
    return 1;
  }
}

main().catch((e) => {
  console.error("❌", errMsg(e));
  process.exit(1);
});
