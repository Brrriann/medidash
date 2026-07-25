"use server";

import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { getImageProvider } from "@/lib/ai/image";

/** 액션 공통 결과 — 실패해도 화면은 기존 배경/레이어를 유지하고 안내만 띄운다 */
export type ImageResult = { ok: true; url: string } | { ok: false; error: string };

function fail(e: unknown): ImageResult {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn("[studio] 이미지 생성 실패:", msg);
  return { ok: false, error: msg };
}

/** AI 배경 생성 — 실패 시 호출부가 부위 테마 그라디언트를 유지한다 */
export async function generateBackgroundAction(
  ingredient: string,
  part: string,
): Promise<ImageResult> {
  try {
    const { url } = await getImageProvider().generateThumbnailBackground({
      ingredient,
      symptom: part || undefined,
      width: 1024,
      height: 1024,
    });
    return { ok: true, url };
  } catch (e) {
    return fail(e);
  }
}

/** AI 인물 컷아웃 생성 (투명 PNG) */
export async function generatePersonAction(
  persona: string,
  outfit: string,
): Promise<ImageResult> {
  try {
    const { url } = await getImageProvider().generatePersonCutout({ persona, outfit });
    return { ok: true, url };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 소싱한 상품의 대표 이미지를 data URL로 가져온다.
 *
 * **URL이 아니라 상품 id를 받는 이유**: 클라이언트가 준 임의 URL을 서버가 받아오면 SSRF가 된다
 * (내부망 주소를 넣어 서버를 정찰 도구로 쓸 수 있다). id로 받아 DB에 적재된 이미지 URL만
 * 쓰면 대상이 크롤러가 넣은 도매몰 이미지로 한정된다.
 *
 * **data URL로 바꿔 내려주는 이유**: 캔버스가 교차 출처 이미지를 그리면 오염(taint)돼
 * `toBlob()`이 SecurityError로 터진다 — PNG 다운로드가 통째로 깨진다.
 */
export async function loadProductImageAction(productId: number): Promise<ImageResult> {
  if (isMockMode()) return { ok: false, error: "mock 모드에서는 상품 이미지를 불러올 수 없습니다." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wholesale_products")
      .select("image_url")
      .eq("id", productId)
      .maybeSingle();
    if (error || !data?.image_url) return { ok: false, error: "상품 이미지가 없습니다." };

    const src = data.image_url.startsWith("//") ? `https:${data.image_url}` : data.image_url;
    const res = await fetch(src);
    if (!res.ok) return { ok: false, error: `상품 이미지를 못 받았습니다 (HTTP ${res.status}).` };

    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return { ok: false, error: "이미지 형식이 아닙니다." };
    const buf = Buffer.from(await res.arrayBuffer());
    // 도매몰 썸네일은 보통 수십 KB다. 비정상적으로 크면 응답 폭증을 막기 위해 거절한다.
    if (buf.byteLength > 5_000_000) return { ok: false, error: "상품 이미지가 너무 큽니다." };
    return { ok: true, url: `data:${type};base64,${buf.toString("base64")}` };
  } catch (e) {
    return fail(e);
  }
}

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
