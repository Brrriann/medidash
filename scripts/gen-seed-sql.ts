/**
 * 분류 체계 + 원료 샘플을 Supabase SQL Editor에 붙여넣을 수 있는 seed.sql로 생성.
 * (터미널 없이 브라우저만으로 DB 시드하기 위함 — docs/DEPLOY.md)
 * 재생성: npx tsx scripts/gen-seed-sql.ts > supabase/seed.sql
 */
import { TAXONOMY } from "../src/lib/taxonomy/data";
import { SAMPLE_INGREDIENTS } from "../src/lib/data/sample-ingredients";

const q = (s: string | null | undefined) =>
  s == null ? "null" : `'${s.replace(/'/g, "''")}'`;
const arr = (xs: string[]) =>
  xs.length ? `array[${xs.map(q).join(",")}]::text[]` : `'{}'::text[]`;

const out: string[] = [];
out.push("-- MediDash 시드 (분류 체계 + 원료 샘플) — Supabase SQL Editor에 붙여넣어 실행");
out.push("-- 마이그레이션(0001_init.sql) 실행 후 사용. 재실행 안전(ON CONFLICT).");
out.push("-- medidash 스키마 대상 (search_path 설정)");
out.push("set search_path = medidash, public;");
out.push("");

// 1) 대분류
out.push("-- 대분류(계통) 10");
for (const c of TAXONOMY) {
  out.push(
    `insert into body_categories (slug, name, svg_region, sort) values (${q(c.slug)}, ${q(c.name)}, ${q(c.svgRegion)}, ${c.sort}) on conflict (slug) do update set name=excluded.name, svg_region=excluded.svg_region, sort=excluded.sort;`,
  );
}
out.push("");

// 2) 중분류
out.push("-- 중분류(부위/기능)");
for (const c of TAXONOMY) {
  for (const s of c.subcategories) {
    out.push(
      `insert into body_subcategories (category_id, slug, name, sort) values ((select id from body_categories where slug=${q(c.slug)}), ${q(s.slug)}, ${q(s.name)}, ${s.sort}) on conflict (slug) do update set name=excluded.name, sort=excluded.sort;`,
    );
  }
}
out.push("");

// 3) 소분류(증상 키워드)
out.push("-- 소분류(증상 키워드)");
for (const c of TAXONOMY) {
  for (const s of c.subcategories) {
    s.symptoms.forEach((kw, i) => {
      out.push(
        `insert into symptom_keywords (subcategory_id, keyword, sort) values ((select id from body_subcategories where slug=${q(s.slug)}), ${q(kw)}, ${i}) on conflict (subcategory_id, keyword) do nothing;`,
      );
    });
  }
}
out.push("");

// 4) 원료 샘플
out.push("-- 원료 샘플 (⚠️ 실데이터는 고객 자료로 교체)");
for (const ing of SAMPLE_INGREDIENTS) {
  out.push(
    `insert into ingredients (name, aliases, certification_type, daily_intake, note) values (${q(ing.name)}, ${arr(ing.aliases)}, ${q(ing.certificationType)}, ${q(ing.dailyIntake)}, ${q(ing.note)}) on conflict (name) do update set aliases=excluded.aliases, certification_type=excluded.certification_type, daily_intake=excluded.daily_intake, note=excluded.note;`,
  );
}
out.push("");

// 5) 증상 ↔ 원료 매핑
out.push("-- 증상 ↔ 원료 매핑");
for (const ing of SAMPLE_INGREDIENTS) {
  for (const [subSlug, keywords] of Object.entries(ing.mappings)) {
    keywords.forEach((kw, rank) => {
      out.push(
        `insert into symptom_ingredients (symptom_id, ingredient_id, rank) values ((select sk.id from symptom_keywords sk join body_subcategories bs on sk.subcategory_id=bs.id where bs.slug=${q(subSlug)} and sk.keyword=${q(kw)}), (select id from ingredients where name=${q(ing.name)}), ${rank}) on conflict (symptom_id, ingredient_id) do nothing;`,
      );
    });
  }
}
out.push("");

process.stdout.write(out.join("\n") + "\n");
