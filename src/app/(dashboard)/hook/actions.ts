"use server";

import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { consumeAiQuota } from "@/lib/ai/quota";
import { logAi } from "@/lib/ai/log";
import { generateHookCopy, type HookPage } from "@/lib/ai/hook";
import { buildProductContext, type ProductContext } from "@/lib/products/context";
import { getAllSubcategoryDetails, getTaxonomy } from "@/lib/data";
import { SAMPLE_PRODUCTS } from "@/lib/data/sample-products";
import { SAMPLE_INGREDIENTS } from "@/lib/data/sample-ingredients";

export interface HookProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  ingredients: string[];
}

export type HookCopyResult =
  | { ok: true; pages: [HookPage, HookPage]; sanitized: boolean }
  | { ok: false; error: string };

/**
 * 상품 하나의 후킹 컨텍스트를 조립한다.
 *
 * 소싱 목록 전체(6,003건)를 부르는 `getWholesaleProducts()`를 쓰지 않고 id로 한 건만
 * 읽는다 — 후킹페이지는 상품 하나만 다루는 화면이라 전량 로드가 낭비다.
 */
async function loadContext(
  productId: number,
): Promise<{ ctx: ProductContext; product: HookProduct } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wholesale_products")
    .select("id, name, image_url, ingredient_ids")
    .eq("id", productId)
    .maybeSingle();
  if (error || !data) return null;

  const ids: number[] = data.ingredient_ids ?? [];
  const { data: ingRows } = ids.length
    ? await supabase.from("ingredients").select("id, name").in("id", ids)
    : { data: [] as { id: number; name: string }[] };
  const ingredients = (ingRows ?? []).map((i) => i.name);

  // 브랜드/원료 구분에 쓸 사전 전체 이름
  const { data: allIng } = await supabase.from("ingredients").select("name");
  const allIngredientNames = (allIng ?? []).map((i) => i.name);

  const [categories, details] = await Promise.all([
    getTaxonomy(),
    getAllSubcategoryDetails(),
  ]);
  const subcategoryNames: Record<string, string> = {};
  const subcategorySymptoms: Record<string, string[]> = {};
  for (const c of categories)
    for (const s of c.subcategories) {
      subcategoryNames[s.slug] = s.name;
      subcategorySymptoms[s.slug] = s.symptoms;
    }

  return {
    ctx: buildProductContext({
      name: data.name,
      ingredients,
      allIngredientNames,
      details,
      subcategoryNames,
      subcategorySymptoms,
    }),
    product: {
      id: data.id,
      name: data.name,
      imageUrl: data.image_url,
      ingredients,
    },
  };
}

/**
 * 화면 초기 표시용 — AI를 부르지 않는다(진입만으로 할당량이 빠지면 안 된다).
 *
 * mock에서는 샘플 상품을 돌려준다. 종전엔 null이라 스튜디오가 통째로 안 보였는데,
 * 화면 구조 확인이 mock의 목적인 만큼 캔버스 렌더링이 검증되지 않는 건 문제다.
 */
export async function loadHookContextAction(
  productId: number,
): Promise<{ ctx: ProductContext; product: HookProduct } | null> {
  if (isMockMode()) {
    const sample = SAMPLE_PRODUCTS[0];
    if (!sample) return null;
    const details = await getAllSubcategoryDetails();
    const categories = await getTaxonomy();
    const subcategoryNames: Record<string, string> = {};
    const subcategorySymptoms: Record<string, string[]> = {};
    for (const c of categories)
      for (const s of c.subcategories) {
        subcategoryNames[s.slug] = s.name;
        subcategorySymptoms[s.slug] = s.symptoms;
      }
    return {
      ctx: buildProductContext({
        name: sample.name,
        ingredients: sample.ingredients,
        allIngredientNames: SAMPLE_INGREDIENTS.map((i) => i.name),
        details,
        subcategoryNames,
        subcategorySymptoms,
      }),
      product: {
        id: sample.id,
        name: sample.name,
        imageUrl: sample.imageUrl ?? null,
        ingredients: sample.ingredients,
      },
    };
  }
  return loadContext(productId);
}

/** 후킹 문구 2장 생성 — 사용자가 버튼을 눌렀을 때만 부른다. */
export async function generateHookAction(productId: number): Promise<HookCopyResult> {
  if (isMockMode())
    return { ok: false, error: "mock 모드에서는 후킹 문구를 만들 수 없습니다." };

  const loaded = await loadContext(productId);
  if (!loaded) return { ok: false, error: "상품을 찾을 수 없습니다." };

  const quota = await consumeAiQuota("text");
  if (!quota.allowed) {
    await logAi("hook_copy", false, { error: quota.reason, meta: { productId } });
    return { ok: false, error: quota.reason };
  }

  try {
    const res = await generateHookCopy(loaded.ctx);
    await logAi("hook_copy", true, {
      meta: {
        productId,
        ingredient: loaded.ctx.ingredients[0] ?? null,
        sanitized: res.sanitized,
      },
    });
    return { ok: true, pages: res.pages, sanitized: res.sanitized };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[hook] 문구 생성 실패:", msg);
    await logAi("hook_copy", false, { error: msg, meta: { productId } });
    return { ok: false, error: msg };
  }
}
