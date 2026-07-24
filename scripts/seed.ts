/**
 * 분류 체계(대·중·소) + 원료 더미 시드.
 * 실행: npm run seed  (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 — .env.local 자동 로드)
 * 재실행해도 중복 없이 upsert된다.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { TAXONOMY } from "../src/lib/taxonomy/data";
import { SAMPLE_INGREDIENTS } from "../src/lib/data/sample-ingredients";

loadEnvFiles([".env.local", ".env"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.\n" +
      "   .env.local 에 채운 뒤 다시 실행하세요. (마이그레이션 supabase/migrations/*.sql 선실행)",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  db: { schema: "medidash" },
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1) 대분류
  const { data: cats, error: catErr } = await db
    .from("body_categories")
    .upsert(
      TAXONOMY.map((c) => ({
        slug: c.slug,
        name: c.name,
        svg_region: c.svgRegion,
        sort: c.sort,
      })),
      { onConflict: "slug" },
    )
    .select("id, slug");
  if (catErr) throw new Error(`body_categories: ${catErr.message}`);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // 2) 중분류
  const subRows = TAXONOMY.flatMap((c) =>
    c.subcategories.map((s) => ({
      category_id: catId.get(c.slug)!,
      slug: s.slug,
      name: s.name,
      sort: s.sort,
    })),
  );
  const { data: subs, error: subErr } = await db
    .from("body_subcategories")
    .upsert(subRows, { onConflict: "slug" })
    .select("id, slug");
  if (subErr) throw new Error(`body_subcategories: ${subErr.message}`);
  const subId = new Map(subs.map((s) => [s.slug, s.id]));

  // 3) 소분류(증상 키워드)
  const symptomRows = TAXONOMY.flatMap((c) =>
    c.subcategories.flatMap((s) =>
      s.symptoms.map((keyword, i) => ({
        subcategory_id: subId.get(s.slug)!,
        keyword,
        sort: i,
      })),
    ),
  );
  const { data: symptoms, error: symErr } = await db
    .from("symptom_keywords")
    .upsert(symptomRows, { onConflict: "subcategory_id,keyword" })
    .select("id, keyword, subcategory_id");
  if (symErr) throw new Error(`symptom_keywords: ${symErr.message}`);
  const subSlugById = new Map(subs.map((s) => [s.id, s.slug]));
  const symptomId = new Map(
    symptoms.map((s) => [`${subSlugById.get(s.subcategory_id)}:${s.keyword}`, s.id]),
  );

  // 4) 원료 더미 (⚠️ 샘플 — 실데이터는 npm run seed:contents 로 교체)
  const { data: ings, error: ingErr } = await db
    .from("ingredients")
    .upsert(
      SAMPLE_INGREDIENTS.map((i) => ({
        name: i.name,
        aliases: i.aliases,
        certification_type: i.certificationType,
        daily_intake: i.dailyIntake,
        note: i.note,
      })),
      { onConflict: "name" },
    )
    .select("id, name");
  if (ingErr) throw new Error(`ingredients: ${ingErr.message}`);
  const ingId = new Map(ings.map((i) => [i.name, i.id]));

  // 5) 증상 ↔ 원료 매핑
  const mappingRows: { symptom_id: number; ingredient_id: number; rank: number }[] = [];
  let missing = 0;
  for (const ing of SAMPLE_INGREDIENTS) {
    for (const [subSlug, keywords] of Object.entries(ing.mappings)) {
      keywords.forEach((keyword, rank) => {
        const sid = symptomId.get(`${subSlug}:${keyword}`);
        if (!sid) {
          console.warn(`⚠️ 증상 없음: ${subSlug}:${keyword} (${ing.name})`);
          missing += 1;
          return;
        }
        mappingRows.push({ symptom_id: sid, ingredient_id: ingId.get(ing.name)!, rank });
      });
    }
  }
  const { error: mapErr } = await db
    .from("symptom_ingredients")
    .upsert(mappingRows, { onConflict: "symptom_id,ingredient_id" });
  if (mapErr) throw new Error(`symptom_ingredients: ${mapErr.message}`);

  console.log(
    [
      "✅ 시드 완료",
      `   대분류      ${cats.length}건`,
      `   중분류      ${subs.length}건`,
      `   증상 키워드 ${symptoms.length}건`,
      `   원료(샘플)  ${ings.length}건`,
      `   매핑        ${mappingRows.length}건${missing ? ` (누락 ${missing})` : ""}`,
    ].join("\n"),
  );
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
  console.error("❌ 시드 실패:", e.message ?? e);
  process.exit(1);
});
