"use server";

import { generateTitleTags } from "@/lib/titles/generate";
import type { TitleInput, TitleTagsResult } from "@/lib/titles/types";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { getKeywordStat } from "@/lib/data";
import { SAMPLE_INGREDIENTS } from "@/lib/data/sample-ingredients";
import { matchIngredients } from "@/lib/ingredients/match";

/**
 * 사용자가 친 자유 원료명 → 사전의 정식 원료명 (keyword_stats 조회 키).
 * 셀러는 "쏘팔메토"라고 치지만 사전 키는 "쏘팔메토 열매 추출물"이다.
 * 크롤러가 상품에 원료를 붙일 때와 **같은 매처**를 써야 결과가 어긋나지 않는다.
 */
function resolveIngredientName(input: string): string | null {
  const dict = SAMPLE_INGREDIENTS.map((i, idx) => ({
    id: idx,
    name: i.name,
    aliases: i.aliases,
  }));
  const ids = matchIngredients(input, dict);
  return ids.length ? dict[ids[0]].name : null;
}

export interface TitlesState {
  result: TitleTagsResult | null;
  error: string | null;
}

/**
 * 상품명·태그 생성 (규칙 기반 — AI 키 불필요).
 * W3에서 AI 어댑터(lib/ai/text.ts) 연동 시, AI 출력도 동일하게 sanitize+scoreExposure를 거쳐
 * 여기서 병합한다. 로그인 상태면 작업 이력(works)에 저장.
 */
export async function generateTitlesAction(
  _prev: TitlesState,
  formData: FormData,
): Promise<TitlesState> {
  const ingredient = String(formData.get("ingredient") ?? "").trim();
  if (!ingredient) return { result: null, error: "대표 원료를 입력하세요." };

  const platform = formData.get("platform") === "smartstore" ? "smartstore" : "coupang";
  const input: TitleInput = {
    ingredient,
    bodyPart: str(formData.get("bodyPart")),
    brand: str(formData.get("brand")),
    spec: str(formData.get("spec")),
    productHint: str(formData.get("productHint")),
    platform,
  };

  // 네이버 실측 지표 주입 — 조회 실패해도 생성은 계속(규칙 기반으로 폴백)
  const canonical = resolveIngredientName(ingredient);
  input.keywordStat = canonical ? await getKeywordStat(canonical).catch(() => null) : null;

  const result = generateTitleTags(input);

  // 로그인 사용자면 작업 이력 저장 (실패해도 결과는 반환)
  if (!isMockMode()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("works").insert({
          user_id: user.id,
          kind: "title_tags",
          input,
          output: result,
        });
      }
    } catch {
      // 이력 저장 실패는 무시 (핵심 기능 아님)
    }
  }

  return { result, error: null };
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}
