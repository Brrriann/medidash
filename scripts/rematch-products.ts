/**
 * 적재된 도매몰 상품을 **재크롤 없이** 최신 원료 사전으로 다시 매칭한다.
 *
 * 원료 사전(`ingredients`)을 늘려도 이미 쌓인 `wholesale_products.ingredient_ids`는
 * 예전 사전 기준 값이라 검색·태그·방송배지가 그대로 안 뜬다. 다시 크롤하면 몰에 부담이고
 * 유픽은 로그인 레이트리밋까지 걸리므로(docs/CRAWL-SELECTORS.md), DB만 훑어 갱신한다.
 *
 * 사용:
 *   npm run rematch -- --dry   # 변경 미리보기만
 *   npm run rematch            # 실제 반영
 */
import { loadEnvFiles } from "../workers/lib/env";
import { createDb, loadIngredientDict } from "../workers/lib/db";
import { matchFromFields } from "../workers/lib/ingredient-match";

loadEnvFiles();

const SOURCES = ["upickb2b", "ggsan", "gonyb2b"] as const;
const PAGE = 1000;

type Row = {
  id: number;
  source: string;
  name: string;
  ingredient_ids: number[] | null;
};

const rate = (m: number, t: number) => (t ? `${((m / t) * 100).toFixed(1)}%` : "—");

async function main() {
  const dry = process.argv.slice(2).includes("--dry");
  const db = createDb();
  if (!db) {
    console.error("❌ Supabase 키가 없습니다 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const dict = await loadIngredientDict(db);
  const ingName = new Map(dict.map((i) => [i.id, i.name]));
  console.log(`\n▶ 재매칭 ${dry ? "(DRY — 반영 안 함)" : ""} · 원료 사전 ${dict.length}종\n`);

  // 전량 로드 (Supabase 요청당 1000행 상한 → range 페이지네이션)
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("wholesale_products")
      .select("id, source, name, ingredient_ids")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`읽기 실패: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  console.log(`  ${rows.length.toLocaleString("ko-KR")}건 로드\n`);

  // 재매칭 + 변경분만 추림
  const changed: { id: number; ids: number[] }[] = [];
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const newlyMatched: Row[] = [];

  for (const r of rows) {
    const had = (r.ingredient_ids ?? []).length > 0;
    const ids = matchFromFields([r.name], dict);
    before.set(r.source, (before.get(r.source) ?? 0) + (had ? 1 : 0));
    after.set(r.source, (after.get(r.source) ?? 0) + (ids.length ? 1 : 0));

    const prev = (r.ingredient_ids ?? []).join(",");
    if (ids.join(",") !== prev) {
      changed.push({ id: r.id, ids });
      if (!had && ids.length) newlyMatched.push(r);
    }
  }

  // 리포트
  const tot = (s: string) => rows.filter((r) => r.source === s).length;
  console.log("  소스별 매칭률 (이전 → 이후)");
  for (const s of SOURCES) {
    const t = tot(s);
    if (!t) continue;
    console.log(
      `    ${s.padEnd(10)} ${String(before.get(s) ?? 0).padStart(5)}/${t}  ${rate(before.get(s) ?? 0, t).padStart(6)}` +
        `  →  ${String(after.get(s) ?? 0).padStart(5)}/${t}  ${rate(after.get(s) ?? 0, t).padStart(6)}`,
    );
  }
  const b = [...before.values()].reduce((a, c) => a + c, 0);
  const a2 = [...after.values()].reduce((a, c) => a + c, 0);
  console.log(
    `    ${"합계".padEnd(10)} ${String(b).padStart(5)}/${rows.length}  ${rate(b, rows.length).padStart(6)}` +
      `  →  ${String(a2).padStart(5)}/${rows.length}  ${rate(a2, rows.length).padStart(6)}`,
  );
  console.log(`\n  변경 ${changed.length.toLocaleString("ko-KR")}건 (신규 매칭 ${newlyMatched.length.toLocaleString("ko-KR")}건)`);

  // 오탐 눈검사용 — 새로 매칭된 상품이 어떤 원료로 잡혔는지 표본
  console.log("\n  신규 매칭 표본 15건:");
  for (const r of newlyMatched.slice(0, 15)) {
    const names = matchFromFields([r.name], dict).map((i) => ingName.get(i) ?? i);
    console.log(`    ${r.name}\n      → ${names.join(", ")}`);
  }

  if (dry) {
    console.log("\n(DRY) 반영하지 않았습니다. 실제 반영: npm run rematch\n");
    return;
  }
  if (!changed.length) {
    console.log("\n변경 없음.\n");
    return;
  }

  // 같은 ingredient_ids끼리 묶어 update — 행당 요청을 수백 건으로 줄인다
  const byIds = new Map<string, number[]>();
  for (const c of changed) {
    const key = c.ids.join(",");
    (byIds.get(key) ?? byIds.set(key, []).get(key)!).push(c.id);
  }
  let done = 0;
  for (const [key, productIds] of byIds) {
    const ids = key ? key.split(",").map(Number) : [];
    for (let i = 0; i < productIds.length; i += 500) {
      const slice = productIds.slice(i, i + 500);
      const { error } = await db
        .from("wholesale_products")
        .update({ ingredient_ids: ids })
        .in("id", slice);
      if (error) throw new Error(`갱신 실패: ${error.message}`);
      done += slice.length;
    }
  }
  console.log(`\n✅ ${done.toLocaleString("ko-KR")}건 갱신 완료\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
