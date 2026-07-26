"use server";

import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { headers } from "next/headers";

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
export async function loadProductImageAction(
  productId: number,
  removeBackground = false,
): Promise<ImageResult> {
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

    // 배경제거를 먼저 시도하고, 안 되면 원본으로 되돌린다.
    // 누끼가 실패해도 상품 이미지는 나와야 한다 — 셀러 입장에선 "안 나오는 것"이 최악이다.
    const cut = removeBackground ? await segmentUrl(src) : null;
    const fetched =
      (cut && (await tryFetchImage(cut))) ?? (await tryFetchImage(src));
    if (!fetched) return { ok: false, error: "상품 이미지를 못 받았습니다." };
    return { ok: true, url: fetched };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Cloudflare Images 배경제거 URL.
 *
 * 픽셀을 다시 그리지 않고 **알파 마스크만** 만들기 때문에 패키지의 한글 표시사항이
 * 한 글자도 안 깨진다. (AI 편집 API로 누끼를 뜨면 "종근당"이 "증근당"이 되고 성분 표기가
 * 통째로 재생성돼 쓸 수 없었다 — lib/ai/image.ts 주석 참고.)
 *
 * 자기 도메인(zone)을 거쳐야 동작한다. 로컬(localhost)에는 이 경로가 없어 null을 돌려주고
 * 호출부가 원본으로 간다. 대시보드에서 도매몰 도메인이 Sources에 등록돼 있어야 한다.
 */
async function segmentUrl(src: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("host");
  if (!host || host.startsWith("localhost") || host.startsWith("127.")) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/cdn-cgi/image/segment=foreground,format=png/${src}`;
}

/** 이미지를 받아 data URL로. 실패·비이미지·과대 용량이면 null (호출부가 폴백한다). */
async function tryFetchImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // 도매몰 썸네일은 보통 수십 KB다. 비정상적으로 크면 응답 폭증을 막기 위해 거절한다.
    if (buf.byteLength > 5_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
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
