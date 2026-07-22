import { TAXONOMY } from "@/lib/taxonomy/data";
import type {
  BodyCategory,
  CertificationType,
  SubcategoryDetail,
} from "@/lib/taxonomy/types";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CONTENTS } from "./mock-contents";
import { SAMPLE_INGREDIENTS } from "./sample-ingredients";
import { SAMPLE_PRODUCTS, type SampleProduct } from "./sample-products";

/**
 * 데이터 저장소 (서버 전용).
 * Supabase 설정 시 DB에서 조회, 미설정(mock 모드) 시 시드 상수로 폴백 —
 * 화면 코드는 어느 모드인지 몰라도 된다.
 */

export async function getTaxonomy(): Promise<BodyCategory[]> {
  if (isMockMode()) return TAXONOMY;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_categories")
    .select(
      "slug, name, svg_region, sort, body_subcategories(slug, name, sort, symptom_keywords(keyword, sort))",
    )
    .order("sort");

  if (error || !data || data.length === 0) {
    // DB 미시드/조회 실패 시 시드 상수 폴백 (npm run seed 안내는 admin 화면에서)
    if (error) console.warn("[data] taxonomy 조회 실패 — 시드 상수 폴백:", error.message);
    return TAXONOMY;
  }

  return data.map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    svgRegion: cat.svg_region,
    sort: cat.sort ?? 0,
    subcategories: (cat.body_subcategories ?? [])
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((sub) => ({
        slug: sub.slug,
        name: sub.name,
        sort: sub.sort ?? 0,
        symptoms: (sub.symptom_keywords ?? [])
          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
          .map((s) => s.keyword),
      })),
  }));
}

/** 중분류 slug → 4-Tab 상세 데이터 전체 맵 (메인 대시보드에서 한 번에 전달) */
export async function getAllSubcategoryDetails(): Promise<
  Record<string, SubcategoryDetail>
> {
  if (isMockMode()) return buildMockDetails();

  const supabase = await createClient();
  const details: Record<string, SubcategoryDetail> = {};

  const { data: contents, error: cErr } = await supabase
    .from("subcategory_contents")
    .select("feature, mechanism, selling_points, source, body_subcategories(slug)");
  const { data: mappings, error: mErr } = await supabase
    .from("symptom_ingredients")
    .select(
      "rank, ingredients(name, certification_type, daily_intake, note), symptom_keywords(keyword, body_subcategories(slug))",
    )
    .order("rank");

  if (cErr || mErr) {
    console.warn("[data] 콘텐츠 조회 실패 — mock 폴백:", cErr?.message ?? mErr?.message);
    return buildMockDetails();
  }

  for (const row of contents ?? []) {
    const slug = unwrap(row.body_subcategories)?.slug;
    if (!slug) continue;
    details[slug] = {
      feature: row.feature,
      mechanism: row.mechanism,
      sellingPoints: row.selling_points ?? [],
      ingredients: [],
      source: row.source === "ai_draft" ? "ai_draft" : "seed",
    };
  }

  for (const row of mappings ?? []) {
    const ing = unwrap(row.ingredients);
    const symptom = unwrap(row.symptom_keywords);
    const slug = unwrap(symptom?.body_subcategories)?.slug;
    if (!ing || !symptom || !slug) continue;
    const detail = (details[slug] ??= emptyDetail("seed"));
    let rec = detail.ingredients.find((r) => r.name === ing.name);
    if (!rec) {
      rec = {
        name: ing.name,
        certificationType: (ing.certification_type as CertificationType) ?? null,
        dailyIntake: ing.daily_intake,
        note: ing.note,
        symptoms: [],
      };
      detail.ingredients.push(rec);
    }
    if (!rec.symptoms.includes(symptom.keyword)) rec.symptoms.push(symptom.keyword);
  }

  return details;
}

/** 최근 작업 이력 (메인 대시보드) — W1은 빈 상태, W3부터 실데이터 */
export async function getRecentWorks(): Promise<
  { kind: string; createdAt: string }[]
> {
  if (isMockMode()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("works")
    .select("kind, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((w) => ({ kind: w.kind, createdAt: w.created_at }));
}

export interface MarginHistoryItem {
  id: number;
  cost: number;
  price: number;
  feeRate: number;
  margin: number;
  marginRate: number;
  createdAt: string;
}

/** 마진 계산 히스토리 (본인 것만 — RLS) */
export async function getMarginHistory(): Promise<MarginHistoryItem[]> {
  if (isMockMode()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("margin_calcs")
    .select("id, inputs, results, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((row) => ({
    id: row.id,
    cost: row.inputs?.cost ?? 0,
    price: row.inputs?.price ?? 0,
    feeRate: row.inputs?.feeRate ?? 0,
    margin: row.results?.margin ?? 0,
    marginRate: row.results?.marginRate ?? 0,
    createdAt: row.created_at,
  }));
}

export type WholesaleProduct = SampleProduct & { isSample: boolean };

/**
 * 도매몰 상품 캐시 조회 (월 1회 크롤러 갱신분).
 * DB가 비어 있으면 mock 샘플 폴백 — W2 크롤러 연결 시 자동으로 실데이터 사용.
 */
export async function getWholesaleProducts(): Promise<{
  products: WholesaleProduct[];
  crawledAt: string | null;
  isSample: boolean;
}> {
  if (!isMockMode()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wholesale_products")
      .select("id, source, source_url, name, price_wholesale, ingredient_ids, crawled_at")
      .order("crawled_at", { ascending: false })
      .limit(200);

    if (!error && data && data.length > 0) {
      // 원료 id → 이름 매핑
      const ids = [...new Set(data.flatMap((p) => p.ingredient_ids ?? []))];
      const { data: ings } = ids.length
        ? await supabase.from("ingredients").select("id, name").in("id", ids)
        : { data: [] as { id: number; name: string }[] };
      const nameById = new Map((ings ?? []).map((i) => [i.id, i.name]));

      return {
        products: data.map((p) => ({
          id: p.id,
          source: p.source,
          sourceUrl: p.source_url,
          name: p.name,
          priceWholesale: p.price_wholesale ?? 0,
          ingredients: (p.ingredient_ids ?? [])
            .map((id: number) => nameById.get(id))
            .filter(Boolean) as string[],
          crawledAt: p.crawled_at,
          isSample: false,
        })),
        crawledAt: data[0]?.crawled_at ?? null,
        isSample: false,
      };
    }
  }

  return {
    products: SAMPLE_PRODUCTS.map((p) => ({ ...p, isSample: true })),
    crawledAt: SAMPLE_PRODUCTS[0]?.crawledAt ?? null,
    isSample: true,
  };
}

// ── 내부 ─────────────────────────────────────────────────────

function buildMockDetails(): Record<string, SubcategoryDetail> {
  const details: Record<string, SubcategoryDetail> = {};

  for (const [slug, content] of Object.entries(MOCK_CONTENTS)) {
    details[slug] = {
      feature: content.feature,
      mechanism: content.mechanism,
      sellingPoints: content.sellingPoints,
      ingredients: [],
      source: "mock",
    };
  }

  for (const ing of SAMPLE_INGREDIENTS) {
    for (const [subSlug, symptoms] of Object.entries(ing.mappings)) {
      const detail = (details[subSlug] ??= emptyDetail("mock"));
      detail.ingredients.push({
        name: ing.name,
        certificationType: ing.certificationType,
        dailyIntake: ing.dailyIntake,
        note: ing.note,
        symptoms,
      });
    }
  }

  return details;
}

function emptyDetail(source: SubcategoryDetail["source"]): SubcategoryDetail {
  return { feature: null, mechanism: null, sellingPoints: [], ingredients: [], source };
}

/** supabase 중첩 관계는 단건이어도 배열로 올 수 있어 정규화 */
function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
