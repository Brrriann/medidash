"use server";

import { generateTitleTags } from "@/lib/titles/generate";
import type { TitleInput, TitleTagsResult } from "@/lib/titles/types";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";

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
