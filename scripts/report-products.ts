/**
 * 도매몰 상품 데이터 리포트 — 크롤 결과 검증용.
 *
 * ⚠️ 이 프로젝트의 클라우드 개발환경은 Supabase가 egress 정책으로 차단돼 있어,
 *    개발자(클라우드 세션)가 데이터를 직접 조회할 수 없다. 그래서 Supabase에 접근 가능한
 *    셀러 로컬(.env.local 에 서비스 키)에서 이 스크립트를 실행해 결과를 확인한다.
 *
 * 실행:  npm run report
 * 필요 env(.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnvFiles([".env.local", ".env"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local).",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  db: { schema: "medidash" },
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Row {
  source: string;
  name: string;
  price_wholesale: number | null;
  image_url: string | null;
  ingredient_ids: number[] | null;
  crawled_at: string | null;
}

const won = (n: number) => "₩" + n.toLocaleString("ko-KR");
const isMatched = (r: Row) => (r.ingredient_ids?.length ?? 0) > 0;

async function main() {
  const { data, error } = await db
    .from("wholesale_products")
    .select("source, name, price_wholesale, image_url, ingredient_ids, crawled_at");
  if (error) throw new Error(`조회 실패: ${error.message}`);
  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    console.log(
      "⚠️ wholesale_products 가 비어 있습니다. 먼저 크롤을 실행하세요: npm run crawl -- --all",
    );
    return;
  }

  const bySource = new Map<string, Row[]>();
  for (const r of rows) {
    (bySource.get(r.source) ?? bySource.set(r.source, []).get(r.source)!).push(r);
  }

  console.log("\n▶ 도매몰 상품 데이터 리포트 (medidash.wholesale_products)\n");
  console.log("소스별:");
  for (const [source, rs] of [...bySource].sort((a, b) => a[0].localeCompare(b[0]))) {
    const prices = rs
      .map((r) => r.price_wholesale)
      .filter((p): p is number => p != null && p > 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const avg = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;
    const noImg = rs.filter((r) => !r.image_url).length;
    const matchN = rs.filter(isMatched).length;
    const pct = Math.round((matchN / rs.length) * 100);
    const latest = rs.map((r) => r.crawled_at ?? "").sort().at(-1) ?? "";
    console.log(
      `  ${source.padEnd(10)} 건수 ${String(rs.length).padStart(4)} · ` +
        `도매가 ${won(min)}~${won(max)}(평균 ${won(avg)}) · ` +
        `이미지없음 ${noImg} · 원료매칭 ${matchN}(${pct}%) · 최근 ${latest.slice(0, 16)}`,
    );
  }

  const total = rows.length;
  const totalMatch = rows.filter(isMatched).length;
  const zeroPrice = rows.filter(
    (r) => r.price_wholesale == null || r.price_wholesale <= 0,
  ).length;
  const noImg = rows.filter((r) => !r.image_url).length;

  console.log(
    `\n합계 ${total}건 · 원료매칭 ${totalMatch}(${Math.round((totalMatch / total) * 100)}%)`,
  );

  console.log("\n점검:");
  console.log(
    `  · 가격 0/없음 : ${zeroPrice}건${zeroPrice ? "  ⚠️ 셀렉터/파싱 확인 필요" : "  ✅"}`,
  );
  console.log(
    `  · 이미지 없음 : ${noImg}건${noImg ? "  ⚠️ image 셀렉터 확인" : "  ✅"}`,
  );
  console.log(
    `  · 원료매칭 0  : ${total - totalMatch}건${
      total - totalMatch ? "  ⚠️ 원료 사전 확장 시 개선" : "  ✅"
    }`,
  );

  console.log("\n샘플(소스별 최대 3건):");
  for (const [source, rs] of [...bySource].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const r of rs.slice(0, 3)) {
      console.log(
        `  [${source}] ${r.name}  ${
          r.price_wholesale != null ? won(r.price_wholesale) : "₩?"
        }  원료${r.ingredient_ids?.length ?? 0}종`,
      );
    }
  }
  console.log("");
}

/** dotenv 없이 .env.local/.env 로드 (이미 설정된 env 는 덮어쓰지 않음) */
function loadEnvFiles(files: string[]) {
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

main().catch((e) => {
  console.error("❌ 리포트 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
