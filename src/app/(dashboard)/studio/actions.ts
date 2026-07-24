"use server";

import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";

export interface ThumbnailWorkInput {
  ingredient: string;
  part: string;
  preset: string;
  /** 블록 레이아웃 메타데이터 (이미지 자체는 클라이언트에서 PNG 다운로드) */
  blocks: Record<string, unknown>[];
}

/**
 * 썸네일 작업 이력 저장 (works.kind='thumbnail').
 * 테스트 버전은 레이아웃 메타데이터만 기록 — 실제 이미지 업로드는 Supabase Storage 연동(W3 후반) 후.
 */
export async function saveThumbnailWork(
  input: ThumbnailWorkInput,
): Promise<{ ok: boolean }> {
  if (isMockMode()) return { ok: false };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const { error } = await supabase.from("works").insert({
      user_id: user.id,
      kind: "thumbnail",
      input: { ingredient: input.ingredient, part: input.part, preset: input.preset },
      output: { blocks: input.blocks },
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
