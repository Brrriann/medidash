"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { calcMargin, type MarginInputs } from "@/lib/margin";

export interface SaveMarginState {
  ok: boolean;
  error: string | null;
}

/** 마진 계산 결과 저장 (margin_calcs — RLS: 본인 행만) */
export async function saveMarginCalc(
  _prev: SaveMarginState,
  formData: FormData,
): Promise<SaveMarginState> {
  if (isMockMode())
    return { ok: false, error: "Mock 모드에서는 저장할 수 없습니다 (Supabase 미연결)." };

  const inputs: MarginInputs = {
    cost: num(formData.get("cost")),
    price: num(formData.get("price")),
    feeRate: num(formData.get("feeRate")),
    shipping: num(formData.get("shipping")),
    extraCost: num(formData.get("extraCost")),
  };
  // 결과는 서버에서 재계산해 저장 (클라이언트 값 신뢰하지 않음)
  const results = calcMargin(inputs);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const productRef = num(formData.get("productRef"));
  const { error } = await supabase.from("margin_calcs").insert({
    user_id: user.id,
    product_ref: productRef > 0 ? productRef : null,
    inputs,
    results,
  });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  revalidatePath("/margin");
  return { ok: true, error: null };
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
