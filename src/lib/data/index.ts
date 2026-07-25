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
  createdAt: string;
  platform: string;
  price: number;
  cost: number;
  finalMargin: number;
  finalMarginRate: number;
}

/** 마진 계산 히스토리 (본인 것만 — RLS). 고객 엑셀 모델 필드(최종마진) 기준 */
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
    createdAt: row.created_at,
    platform: row.inputs?.platform ?? "",
    price: row.inputs?.price ?? 0,
    cost: row.inputs?.cost ?? 0,
    finalMargin: row.results?.finalMargin ?? 0,
    finalMarginRate: row.results?.finalMarginRate ?? 0,
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
    const SEL =
      "id, source, source_url, name, price_wholesale, image_url, ingredient_ids, crawled_at";
    // Supabase는 요청당 행 상한(기본 1000)이 있어, range로 전량을 나눠 가져온다.
    // crawled_at은 배치마다 동점이 많으므로 id를 2차 정렬키로 둬 페이지네이션을 안정화.
    // ponytail: 카탈로그가 수만 건으로 커지면 클라 전량로드 대신 서버측 검색으로 전환.
    const PAGE = 1000;
    const q = () =>
      supabase
        .from("wholesale_products")
        .select(SEL)
        .order("crawled_at", { ascending: false })
        .order("id", { ascending: false });
    const first = await q().range(0, PAGE - 1);
    const data = first.data ?? [];
    const error = first.error;
    if (!error && data.length === PAGE) {
      for (let from = PAGE; from < 20000; from += PAGE) {
        const more = await q().range(from, from + PAGE - 1);
        if (more.error || !more.data?.length) break;
        data.push(...more.data);
        if (more.data.length < PAGE) break;
      }
    }

    if (!error && data.length > 0) {
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
          imageUrl: p.image_url ?? null,
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

export type BroadcastStat = { count: number; titles: string[] };

/**
 * 원료명 → 홈쇼핑모아 방송 지표 맵 (broadcast_stats, kind=ingredient).
 * count는 최근 방송 상품 수(≤10, hsmoa 상위 제공분). mock/오류/없음 시 빈 맵.
 */
export async function getBroadcastStats(): Promise<Record<string, BroadcastStat>> {
  if (isMockMode()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_stats")
    .select("keyword, broadcast_count, recent_titles")
    .eq("kind", "ingredient");
  if (error || !data) return {};
  const map: Record<string, BroadcastStat> = {};
  for (const r of data) {
    map[r.keyword] = {
      count: r.broadcast_count ?? 0,
      titles: Array.isArray(r.recent_titles) ? (r.recent_titles as string[]) : [],
    };
  }
  return map;
}

/** 네이버 실측 키워드 지표 (medidash.keyword_stats) */
export interface KeywordStat {
  keyword: string;
  /** 데이터랩 12개월 검색 트렌드 평균, 앵커("콜라겐")=1.0 기준. 미수집이면 null */
  demandIndex: number | null;
  /** 네이버쇼핑 등록 상품수 — 클수록 경쟁이 심하다 */
  competition: number | null;
  /** 상위 노출 상품명에 함께 쓰인 어휘 (빈도 내림차순) */
  related: { term: string; count: number }[];
}

/** 원료명 하나의 키워드 지표. 미수집·mock이면 null → 호출부는 규칙 기반으로 폴백한다. */
export async function getKeywordStat(keyword: string): Promise<KeywordStat | null> {
  if (isMockMode()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("keyword_stats")
    .select("keyword, demand_index, competition, related_keywords")
    .eq("kind", "ingredient")
    .eq("keyword", keyword)
    .maybeSingle();
  if (error || !data) return null;
  return {
    keyword: data.keyword,
    demandIndex: data.demand_index === null ? null : Number(data.demand_index),
    competition: data.competition ?? null,
    related: Array.isArray(data.related_keywords)
      ? (data.related_keywords as { term: string; count: number }[])
      : [],
  };
}

/** 소싱 화면용 — 전 키워드 지표를 원료명 → 지표 맵으로 (카드마다 조회하면 N+1이 된다). */
export async function getKeywordStats(): Promise<Record<string, KeywordStat>> {
  if (isMockMode()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("keyword_stats")
    .select("keyword, demand_index, competition, related_keywords")
    .eq("kind", "ingredient");
  if (error || !data) return {};
  const map: Record<string, KeywordStat> = {};
  for (const r of data) {
    map[r.keyword] = {
      keyword: r.keyword,
      demandIndex: r.demand_index === null ? null : Number(r.demand_index),
      competition: r.competition ?? null,
      related: Array.isArray(r.related_keywords)
        ? (r.related_keywords as { term: string; count: number }[])
        : [],
    };
  }
  return map;
}

export interface InviteCodeRow {
  code: string;
  memo: string | null;
  maxUses: number;
  used: number;
  expiresAt: string | null;
  isSample: boolean;
}

export interface MemberRow {
  email: string | null;
  role: string;
  inviteCode: string | null;
  createdAt: string;
  isSample: boolean;
}

/** admin 화면 데이터 — 코드 목록 + 회원 목록 (mock 모드는 데모 표시용 샘플) */
export async function getAdminData(): Promise<{
  codes: InviteCodeRow[];
  members: MemberRow[];
}> {
  if (isMockMode()) {
    return {
      codes: [
        { code: "MEDI-DEMO-0001", memo: "[샘플] 7월 기수", maxUses: 10, used: 3, expiresAt: "2026-08-31T14:59:59Z", isSample: true },
        { code: "MEDI-DEMO-0002", memo: "[샘플] 체험판", maxUses: 1, used: 1, expiresAt: null, isSample: true },
      ],
      members: [
        { email: "sample-seller@example.com", role: "member", inviteCode: "MEDI-DEMO-0001", createdAt: "2026-07-10T02:00:00Z", isSample: true },
        { email: "sample-admin@example.com", role: "admin", inviteCode: null, createdAt: "2026-07-01T02:00:00Z", isSample: true },
      ],
    };
  }

  const supabase = await createClient();
  const [{ data: codes }, { data: members }] = await Promise.all([
    supabase
      .from("invite_codes")
      .select("code, memo, max_uses, used, expires_at")
      .order("code"),
    supabase
      .from("profiles")
      .select("email, role, invite_code, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return {
    codes: (codes ?? []).map((c) => ({
      code: c.code,
      memo: c.memo,
      maxUses: c.max_uses ?? 1,
      used: c.used ?? 0,
      expiresAt: c.expires_at,
      isSample: false,
    })),
    members: (members ?? []).map((m) => ({
      email: m.email,
      role: m.role,
      inviteCode: m.invite_code,
      createdAt: m.created_at,
      isSample: false,
    })),
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
