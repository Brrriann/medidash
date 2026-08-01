"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_DISCLAIMER } from "@/lib/constants";
import {
  BULLET_SHAPES,
  DEFAULT_HOOK_STYLE,
  HOOK_FONTS,
  HOOK_H,
  HOOK_W,
  renderHookPage,
  DEFAULT_PAGE_LAYOUT,
  type BulletShape,
  type DrawnBounds,
  type HookFontKey,
  type HookStyle,
  type PageLayout,
} from "@/lib/hook/render";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * 색 입력 — **비우기 버튼이 붙는다.**
 * `<input type="color">`는 빈 값을 표현할 수 없어(항상 어떤 색을 들고 있다) 자동 모드로
 * 되돌릴 방법이 없다. 그래서 "자동" 버튼을 따로 둔다.
 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#0f172a"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 shrink-0 cursor-pointer rounded border border-slate-300"
        />
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            value
              ? "border-slate-200 text-slate-600 hover:bg-slate-50"
              : "border-brand-300 bg-brand-50 text-brand-700"
          }`}
        >
          {value ? "자동으로" : "자동"}
        </button>
      </div>
    </Field>
  );
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
  // gpt-image-2가 상품 사진으로 만든 완성 씬. **제품이 이 안에 들어 있어** 따로 합성하지 않는다.
  const [scene, setScene] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 두 장이 같은 스타일을 쓴다 — 연작이라 글꼴·색이 달라지면 오히려 어색하다.
  const [style, setStyle] = useState<HookStyle>(DEFAULT_HOOK_STYLE);
  // 문구 위치는 장마다 따로 잡는다 — 문구 길이가 달라 같은 자리가 안 맞는다.
  const [layouts, setLayouts] = useState<[PageLayout, PageLayout]>([
    structuredClone(DEFAULT_PAGE_LAYOUT),
    structuredClone(DEFAULT_PAGE_LAYOUT),
  ]);
  // 렌더러가 그린 실제 영역 — 어느 덩어리를 잡았는지 판정하는 데 쓴다.
  const boundsRef = useRef<(DrawnBounds | null)[]>([null, null]);
  const dragRef = useRef<{
    page: 0 | 1;
    block: "head" | "panel";
    dx: number;
    dy: number;
  } | null>(null);
  const refs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];

  const draw = useCallback(() => {
    pages.forEach((page, i) => {
      const c = refs[i].current;
      if (!c) return;
      boundsRef.current[i] = renderHookPage(c, {
        page,
        background: scene,
        specText,
        disclaimer: AI_DISCLAIMER,
        index: i as 0 | 1,
        style,
        layout: layouts[i],
      });
    });
    // refs는 렌더마다 같은 객체라 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, scene, specText, style, layouts]);

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

  /**
   * 씬 생성 — 상품 사진을 참고 이미지로 넣어 배경과 제품을 **한 번에** 만든다.
   *
   * 종전엔 "AI 배경"과 "상품 누끼" 두 버튼이었다. gpt-image-2가 상품 사진을 그대로 두고
   * 씬을 만들어 주면서 둘 다 필요 없어졌고, 누끼는 Cloudflare 엣지 의존이라 로컬에서
   * 오류만 났다. 버튼 하나로 합친다.
   */
  async function makeScene() {
    setBusy("이미지 생성 중… 최대 1분");
    setError(null);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "hook_scene",
          productId: product.id,
          ingredient,
          part: symptom,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `이미지 생성 실패 (HTTP ${res.status})`);
      }
      setScene(await loadImage(URL.createObjectURL(await res.blob())));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
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

  const set = (patch: Partial<HookStyle>) => setStyle((s) => ({ ...s, ...patch }));

  /** 화면 좌표 → 캔버스 좌표. 캔버스는 CSS로 축소돼 있어 배율을 되돌려야 한다. */
  function toCanvas(c: HTMLCanvasElement, e: React.PointerEvent) {
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * HOOK_W,
      y: ((e.clientY - r.top) / r.height) * HOOK_H,
    };
  }

  function onPointerDown(i: 0 | 1, e: React.PointerEvent<HTMLCanvasElement>) {
    const c = refs[i].current;
    const b = boundsRef.current[i];
    if (!c || !b) return;
    const p = toCanvas(c, e);
    const hit = (r: { x: number; y: number; w: number; h: number } | null) =>
      !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

    // 패널을 먼저 본다 — 머리 덩어리와 겹칠 때 아래 것을 잡는 게 자연스럽다.
    const block = hit(b.panel) ? "panel" : hit(b.head) ? "head" : null;
    if (!block) return;
    const cur = layouts[i][block];
    dragRef.current = {
      page: i,
      block,
      dx: p.x - cur.x * HOOK_W,
      dy: p.y - cur.y * HOOK_H,
    };
    c.setPointerCapture(e.pointerId);
  }

  function onPointerMove(i: 0 | 1, e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current;
    const c = refs[i].current;
    if (!d || d.page !== i || !c) return;
    const p = toCanvas(c, e);
    // 캔버스 밖으로 나가지 않게 가둔다.
    const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
    setLayouts((ls) => {
      const next = [...ls] as [PageLayout, PageLayout];
      next[i] = {
        ...next[i],
        [d.block]: {
          x: clamp((p.x - d.dx) / HOOK_W),
          y: clamp((p.y - d.dy) / HOOK_H),
        },
      };
      return next;
    });
  }

  const endDrag = () => (dragRef.current = null);

  function resetLayout() {
    setLayouts([structuredClone(DEFAULT_PAGE_LAYOUT), structuredClone(DEFAULT_PAGE_LAYOUT)]);
  }

  const hasCopy = pages.some((p) => p.headline);

  return (
    <div className="space-y-5">
      {/* 생성 도구 */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">1단계</span>
          <button
            type="button"
            onClick={makeScene}
            disabled={!!busy || !product.imageUrl}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            이미지 만들기
          </button>
          <span className="text-slate-300">→</span>
          <span className="text-[11px] font-bold text-slate-400">2단계</span>
          <button
            type="button"
            onClick={makeCopy}
            disabled={!!busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-400 disabled:opacity-50"
          >
            문구 만들기
          </button>
          {busy && <span className="text-xs text-slate-400">{busy}</span>}
        </div>

        {/* **비활성 이유를 반드시 적는다.** 회색 버튼만 있으면 "버튼이 없다"로 읽힌다. */}
        {!product.imageUrl && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이 상품에는 대표 이미지가 없어 이미지를 만들 수 없습니다. 문구만 만들어
            쓰시거나, 대표 이미지가 있는 다른 상품을 골라 주세요.
          </p>
        )}

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

      {/* 스타일 */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-800">글자·불릿 스타일</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="폰트">
            <select
              value={style.font}
              onChange={(e) => set({ font: e.target.value as HookFontKey })}
              className={inputCls}
            >
              {HOOK_FONTS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`글자 크기 ${Math.round(style.scale * 100)}%`}>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={style.scale}
              onChange={(e) => set({ scale: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </Field>

          <Field label="불릿 모양">
            <select
              value={style.bulletShape}
              onChange={(e) => set({ bulletShape: e.target.value as BulletShape })}
              className={inputCls}
            >
              {BULLET_SHAPES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`불릿 크기 ${Math.round(style.bulletScale * 100)}%`}>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.1}
              value={style.bulletScale}
              onChange={(e) => set({ bulletScale: Number(e.target.value) })}
              disabled={style.bulletShape === "none"}
              className="w-full accent-brand-600 disabled:opacity-40"
            />
          </Field>

          <ColorField
            label="글자색"
            value={style.textColor}
            onChange={(v) => set({ textColor: v })}
          />
          <ColorField
            label="강조색 (배지·불릿)"
            value={style.accentColor}
            onChange={(v) => set({ accentColor: v })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] text-slate-500">
            미리보기에서 <strong>문구 덩어리를 끌어</strong> 위치를 옮길 수 있습니다.
          </span>
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            위치 초기화
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          색을 비워두면 장의 톤에 맞춰 자동으로 정해집니다 — 1장(어두운 배경)은 흰 글씨,
          2장(밝은 배경)은 검은 글씨.
        </p>
      </section>

      {/* 2장 */}
      <div className="grid gap-5 md:grid-cols-2">
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
                title={hasCopy ? "" : "문구를 먼저 만들어 주세요"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 disabled:opacity-40"
              >
                PNG 저장
              </button>
            </div>

            <div className="relative">
              <canvas
                ref={refs[i]}
                onPointerDown={(e) => onPointerDown(i, e)}
                onPointerMove={(e) => onPointerMove(i, e)}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="block w-full touch-none bg-slate-100"
                style={{ aspectRatio: `${HOOK_W} / ${HOOK_H}`, cursor: hasCopy ? "grab" : "default" }}
              />
              {!hasCopy && !scene && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rounded-xl bg-white/90 px-4 py-3 text-center text-xs leading-relaxed text-slate-500">
                    위에서 <strong>이미지 만들기</strong> → <strong>문구 만들기</strong>
                    <br />
                    순서로 눌러 주세요
                  </p>
                </div>
              )}
            </div>

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
