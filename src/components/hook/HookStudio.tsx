"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_DISCLAIMER } from "@/lib/constants";
import { HOOK_H, HOOK_W, renderHookPage } from "@/lib/hook/render";
import { generateHookAction, type HookProduct } from "@/app/(dashboard)/hook/actions";
import type { HookPage } from "@/lib/ai/hook";
import type { AiQuotaView } from "@/lib/ai/quota";

const BLANK: HookPage = { badge: "", headline: "", sub: "", points: [] };

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/** 이미지를 로드해 캔버스에 그릴 수 있는 상태로 만든다 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

export function HookStudio({
  product,
  specText,
  ingredient,
  symptom,
  quota,
}: {
  product: HookProduct;
  specText: string;
  ingredient: string;
  /** 배경 프롬프트에 분위기를 잡아주는 증상 키워드 */
  symptom: string;
  quota: AiQuotaView;
}) {
  const [pages, setPages] = useState<[HookPage, HookPage]>([BLANK, BLANK]);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [cut, setCut] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];

  const draw = useCallback(() => {
    pages.forEach((page, i) => {
      const c = refs[i].current;
      if (c)
        renderHookPage(c, {
          page,
          background: bg,
          product: cut,
          specText,
          disclaimer: AI_DISCLAIMER,
          index: i as 0 | 1,
        });
    });
    // refs는 렌더마다 같은 객체라 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, bg, cut, specText]);

  useEffect(draw, [draw]);

  async function makeCopy() {
    setBusy("문구 생성 중…");
    setError(null);
    setNotice(null);
    const res = await generateHookAction(product.id);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setPages(res.pages);
    if (res.sanitized)
      setNotice("의약품 오인 표현이 광고 안전 표현으로 자동 치환되었습니다.");
  }

  /** 배경은 **한 번만** 만들어 2장이 공유한다 — 연작이라 톤이 이어지는 게 자연스럽고, 비용도 절반이다. */
  async function makeBackground() {
    setBusy("배경 생성 중…");
    setError(null);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "hook_bg", ingredient, part: symptom }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `배경 생성 실패 (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      setBg(await loadImage(URL.createObjectURL(blob)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /**
   * 상품 누끼. **브라우저가 직접** /cdn-cgi/image/를 불러야 한다 —
   * 서버(Worker)가 자기 도메인의 그 경로를 fetch하면 엣지를 안 타고 원본이 나온다.
   */
  async function makeCutout() {
    if (!product.imageUrl) return setError("상품 대표 이미지가 없습니다.");
    setBusy("배경 제거 중…");
    setError(null);
    const src = product.imageUrl.startsWith("//")
      ? `https:${product.imageUrl}`
      : product.imageUrl;
    for (const opt of ["segment=foreground,format=png", "format=png"]) {
      try {
        const res = await fetch(`/cdn-cgi/image/${opt}/${src}`);
        if (!res.ok) continue;
        setCut(await loadImage(URL.createObjectURL(await res.blob())));
        setBusy(null);
        return;
      } catch {
        // 다음 옵션으로 폴백 (배경제거 실패 시 원본이라도 쓴다)
      }
    }
    setBusy(null);
    setError("상품 이미지를 불러오지 못했습니다.");
  }

  function download(i: number) {
    const c = refs[i].current;
    c?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `후킹페이지_${i + 1}_${ingredient || product.id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  function edit(i: 0 | 1, patch: Partial<HookPage>) {
    setPages((p) => {
      const next = [...p] as [HookPage, HookPage];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  const hasCopy = pages.some((p) => p.headline);

  return (
    <div className="space-y-5">
      {/* 생성 도구 */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={makeCopy}
            disabled={!!busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            문구 만들기
          </button>
          <button
            type="button"
            onClick={makeBackground}
            disabled={!!busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-400 disabled:opacity-50"
          >
            AI 배경 (2장 공용)
          </button>
          <button
            type="button"
            onClick={makeCutout}
            disabled={!!busy || !product.imageUrl}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-400 disabled:opacity-50"
          >
            상품 누끼
          </button>
          {busy && <span className="text-xs text-slate-400">{busy}</span>}
        </div>

        {!quota.unlimited && (
          <p className="mt-3 text-[11px] text-slate-400">
            오늘 문구 {Math.max(quota.text.limit - quota.text.used, 0)}회 · 이미지{" "}
            {Math.max(quota.image.limit - quota.image.used, 0)}회 남았습니다. 배경은 2장이
            공유해 1회만 씁니다.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {notice}
          </p>
        )}
      </section>

      {/* 2장 */}
      <div className="grid gap-5 lg:grid-cols-2">
        {([0, 1] as const).map((i) => (
          <section key={i} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-bold text-slate-800">
                {i === 0 ? "1장 · 문제 후킹" : "2장 · 해결 후킹"}
              </span>
              <button
                type="button"
                onClick={() => download(i)}
                disabled={!hasCopy}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 disabled:opacity-40"
              >
                PNG 저장
              </button>
            </div>

            <canvas
              ref={refs[i]}
              className="block w-full bg-slate-100"
              style={{ aspectRatio: `${HOOK_W} / ${HOOK_H}` }}
            />

            <div className="space-y-2 p-4">
              <input
                value={pages[i].badge}
                onChange={(e) => edit(i, { badge: e.target.value })}
                placeholder="배지 (예: 이런 분들께)"
                className={inputCls}
              />
              <input
                value={pages[i].headline}
                onChange={(e) => edit(i, { headline: e.target.value })}
                placeholder="큰 문구"
                className={`${inputCls} font-semibold`}
              />
              <input
                value={pages[i].sub}
                onChange={(e) => edit(i, { sub: e.target.value })}
                placeholder="보조 문구"
                className={inputCls}
              />
              <input
                value={pages[i].points.join(" / ")}
                onChange={(e) =>
                  edit(i, {
                    points: e.target.value
                      .split("/")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="불릿 — / 로 구분"
                className={inputCls}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
