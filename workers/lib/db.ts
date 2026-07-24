/**
 * 크롤러 DB 레이어 — Supabase service role로 원료 사전 조회 + 상품 upsert.
 * 재실행 시 source_url 기준 중복 없이 upsert (docs/SPEC.md §10 인수 기준).
 */
import { createClient } from "@supabase/supabase-js";
import type { IngredientDict, WholesaleRecord } from "./types";
import { getSupabaseConfig } from "./env";

/** medidash 스키마 클라이언트 타입 (버전별 제네릭 arity 차이를 추론으로 흡수) */
function makeClient(url: string, key: string) {
  return createClient(url, key, {
    db: { schema: "medidash" }, // MediDash 전용 스키마
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
type Db = ReturnType<typeof makeClient>;

export function createDb(): Db | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  return makeClient(cfg.url, cfg.serviceKey);
}

/** 원료 사전(id·name·aliases) 로드 — 매칭 입력 */
export async function loadIngredientDict(db: Db): Promise<IngredientDict[]> {
  const { data, error } = await db.from("ingredients").select("id, name, aliases");
  if (error) throw new Error(`ingredients 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    aliases: r.aliases ?? [],
  }));
}

/** 상품 캐시 upsert (source_url 충돌 시 갱신) */
export async function upsertProducts(
  db: Db,
  records: WholesaleRecord[],
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => ({
    source: r.source,
    source_url: r.sourceUrl,
    name: r.name,
    price_wholesale: r.priceWholesale,
    image_url: r.imageUrl,
    detail: r.detail ?? { text: r.detailText },
    ingredient_ids: r.ingredientIds,
    crawled_at: r.crawledAt,
  }));
  const { error } = await db
    .from("wholesale_products")
    .upsert(rows, { onConflict: "source_url" });
  if (error) throw new Error(`wholesale_products upsert 실패: ${error.message}`);
  return rows.length;
}
