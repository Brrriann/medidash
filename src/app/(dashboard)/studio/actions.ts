"use server";

import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";

/** 액션 공통 결과 — 실패해도 화면은 기존 배경/레이어를 유지하고 안내만 띄운다 */
export type ImageResult = { ok: true; url: string } | { ok: false; error: string };

function fail(e: unknown): ImageResult {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn("[studio] 이미지 생성 실패:", msg);
  return { ok: false, error: msg };
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
/**
 * 소싱한 상품의 대표 이미지 **URL**을 돌려준다.
 *
 * **바이트가 아니라 URL을 주는 이유**: 배경제거(/cdn-cgi/image/)는 Cloudflare 엣지가
 * 처리하는데, Worker가 자기 도메인의 그 경로를 fetch하면 엣지를 안 타고 Worker로 되돌아온다.
 * 그래서 서버에서 변환을 부르면 조용히 원본이 나왔다. 브라우저가 직접 부르면 엣지가
 * 처리하고, 우리 도메인이라 같은 출처여서 캔버스 오염(taint)도 없다.
 *
 * **URL이 아니라 상품 id를 받는 이유**: 클라이언트가 준 임의 URL을 그대로 쓰면
 * 변환 통로가 열린다. id로 받아 DB에 적재된 도매몰 이미지로 대상을 한정한다.
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
    return { ok: true, url: src };
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
