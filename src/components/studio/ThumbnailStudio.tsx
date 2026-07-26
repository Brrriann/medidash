"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THUMBNAIL_PRESETS, AI_DISCLAIMER } from "@/lib/constants";
import { generateBackground, type GradientSpec } from "@/lib/thumbnail/backgrounds";
import { saveThumbnailWork, loadProductImageAction } from "@/app/(dashboard)/studio/actions";

type PresetKey = (typeof THUMBNAIL_PRESETS)[number]["key"];

interface TextBlock {
  id: string;
  type: "text";
  x: number;
  y: number; // 중심, 정규화 0..1
  text: string;
  size: number; // 캔버스 높이 대비 비율
  color: string;
}
interface BadgeBlock {
  id: string;
  type: "badge";
  x: number;
  y: number;
  size: number;
}
interface LogoBlock {
  id: string;
  type: "logo";
  x: number;
  y: number;
  size: number;
  src: string;
}
type Block = TextBlock | BadgeBlock | LogoBlock;

const DISPLAY = 460;
type Box = { x0: number; y0: number; x1: number; y1: number };

export function ThumbnailStudio({
  defaults,
  mock,
  quota,
}: {
  defaults: { ingredient: string; part: string; productId: number | null };
  mock: boolean;
  /** AI 일일 한도 — 안 보여주면 왜 막혔는지 셀러가 알 수 없다 */
  quota: { used: number; limit: number; unlimited: boolean };
}) {
  const [presetKey, setPresetKey] = useState<PresetKey>("coupang");
  const [bgSeed, setBgSeed] = useState(0);
  const bg: GradientSpec = useMemo(
    () => generateBackground(defaults.part, bgSeed),
    [defaults.part, bgSeed],
  );

  const idRef = useRef(0);
  const nid = () => `b${idRef.current++}`;
  const [blocks, setBlocks] = useState<Block[]>(() => [
    { id: "b_head", type: "text", x: 0.5, y: 0.22, text: defaults.ingredient || "원료명", size: 0.1, color: "#ffffff" },
    { id: "b_copy", type: "text", x: 0.5, y: 0.82, text: "하루 한 알 건강 관리", size: 0.052, color: "#ffffff" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>("b_head");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  /** AI가 만든 배경 (data URL). 없으면 부위 테마 그라디언트를 쓴다. */
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [persona, setPersona] = useState("40대 남성");
  const [outfit, setOutfit] = useState("깔끔한 정장");
  /** 상품 이미지 배경제거(Cloudflare Images). 결과가 마음에 안 들 수 있어 셀러가 고르게 둔다. */
  const [cutout, setCutout] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxes = useRef<Record<string, Box>>({});
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imgTick, setImgTick] = useState(0); // 로고 로드 시 리드로우 트리거

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  /** 로고 이미지 확보(캐시) */
  const getImg = useCallback(
    (src: string): HTMLImageElement | null => {
      const cached = imgCache.current.get(src);
      if (cached) return cached.complete ? cached : null;
      const img = new Image();
      img.onload = () => setImgTick((t) => t + 1);
      // onerror가 없으면 이미지가 깨져도 화면에 아무 일도 안 일어난다.
      // 실제로 인물 생성이 깨졌을 때 오류 표시가 없어 원인 파악이 늦어졌다.
      img.onerror = () => setNote("이미지를 불러오지 못했습니다. 다시 시도해 주세요.");
      img.src = src;
      imgCache.current.set(src, img);
      return null;
    },
    [],
  );

  /** 캔버스 1회 렌더 — forExport면 선택 외곽선 생략, bbox 기록 안 함 */
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, forExport: boolean) => {
      // 배경 — AI 이미지가 있으면 꽉 채워 덮고(cover), 없으면 부위 테마 그라디언트
      const bgImg = bgImage ? getImg(bgImage) : null;
      if (bgImg) {
        const r = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
        const dw = bgImg.naturalWidth * r;
        const dh = bgImg.naturalHeight * r;
        ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
      const rad = (bg.angle * Math.PI) / 180;
      const g = ctx.createLinearGradient(
        W / 2 - (Math.cos(rad) * W) / 2,
        H / 2 - (Math.sin(rad) * H) / 2,
        W / 2 + (Math.cos(rad) * W) / 2,
        H / 2 + (Math.sin(rad) * H) / 2,
      );
      g.addColorStop(0, bg.c1);
      g.addColorStop(1, bg.c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      }
      // 하단 가독성 그늘
      const shade = ctx.createLinearGradient(0, H * 0.5, 0, H);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);

      for (const b of blocks) {
        let box: Box;
        if (b.type === "text") box = drawText(ctx, b, W, H);
        else if (b.type === "badge") box = drawBadge(ctx, b, W, H);
        else box = drawLogo(ctx, b, W, H, getImg(b.src));
        if (!forExport) {
          boxes.current[b.id] = box;
          if (b.id === selectedId) {
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(box.x0 * W, box.y0 * H, (box.x1 - box.x0) * W, (box.y1 - box.y0) * H);
            ctx.setLineDash([]);
          }
        }
      }
    },
    [bg, bgImage, blocks, selectedId, getImg],
  );

  // 디스플레이 리드로우
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, DISPLAY, DISPLAY);
    draw(ctx, DISPLAY, DISPLAY, false);
  }, [draw, imgTick]);

  // ── 포인터 드래그 ──
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const toNorm = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onDown = (e: React.PointerEvent) => {
    const p = toNorm(e);
    const hit = [...blocks].reverse().find((b) => {
      const bx = boxes.current[b.id];
      return bx && p.x >= bx.x0 && p.x <= bx.x1 && p.y >= bx.y0 && p.y <= bx.y1;
    });
    if (hit) {
      setSelectedId(hit.id);
      dragRef.current = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y };
      canvasRef.current!.setPointerCapture(e.pointerId);
    } else {
      setSelectedId(null);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toNorm(e);
    setBlocks((bs) =>
      bs.map((b) =>
        b.id === d.id
          ? { ...b, x: clamp(p.x - d.dx, 0.02, 0.98), y: clamp(p.y - d.dy, 0.02, 0.98) }
          : b,
      ),
    );
  };
  const onUp = () => (dragRef.current = null);

  // ── 블록 조작 ──
  const addText = () => {
    const id = nid();
    setBlocks((bs) => [...bs, { id, type: "text", x: 0.5, y: 0.5, text: "텍스트", size: 0.06, color: "#ffffff" }]);
    setSelectedId(id);
  };
  const addBadge = () => {
    if (blocks.some((b) => b.type === "badge")) return;
    const id = nid();
    setBlocks((bs) => [...bs, { id, type: "badge", x: 0.16, y: 0.1, size: 0.28 }]);
    setSelectedId(id);
  };
  /** 이미지 레이어 추가 — 인물·상품·로고가 모두 같은 타입이다 */
  const addImage = (src: string, x: number, y: number, size: number) => {
    const id = nid();
    setBlocks((bs) => [...bs, { id, type: "logo", x, y, size, src }]);
    setSelectedId(id);
  };

  /**
   * AI 이미지 생성 — 서버 액션이 아니라 라우트 핸들러를 부른다.
   * 인물 컷아웃(투명 PNG)은 2MB라 서버 액션 RSC 페이로드로 넘기면 Workers에서 깨졌다.
   * 라우트에서 원본 바이트를 받아 blob URL로 쓰면 같은 출처라 캔버스 오염도 없다.
   */
  const requestImage = async (body: Record<string, string>): Promise<string | null> => {
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await res
        .json()
        .then((j: { error?: string }) => j.error)
        .catch(() => `HTTP ${res.status}`);
      setNote(`이미지 생성 실패 — ${msg}`);
      return null;
    }
    return URL.createObjectURL(await res.blob());
  };

  /** AI 배경 생성. 실패하면 기존 그라디언트를 그대로 두고 사유만 알린다. */
  const genBackground = async () => {
    setBusy("bg");
    setNote(null);
    const url = await requestImage({
      kind: "background",
      ingredient: defaults.ingredient,
      part: defaults.part,
    });
    setBusy(null);
    if (url) setBgImage(url);
  };

  const genPerson = async () => {
    setBusy("person");
    setNote(null);
    const url = await requestImage({ kind: "person", persona, outfit });
    setBusy(null);
    // 인물은 좌측에 크게 — 레퍼런스 구도(인물 좌측, 제품 우측)를 기본값으로
    if (url) addImage(url, 0.26, 0.6, 0.52);
  };

  /**
   * 소싱 상품 이미지를 캔버스에 올린다.
   *
   * **변환은 브라우저가 직접 부른다.** 배경제거(/cdn-cgi/image/)는 Cloudflare 엣지가
   * 처리하는데, Worker가 자기 도메인의 그 경로를 fetch하면 엣지를 안 타고 Worker로
   * 되돌아온다(그래서 서버에서 부르면 조용히 원본이 나왔다).
   * 우리 도메인이라 같은 출처여서 캔버스 오염(taint)도 없다.
   */
  const addProduct = async () => {
    if (!defaults.productId) return;
    setBusy("product");
    setNote(null);
    const r = await loadProductImageAction(defaults.productId);
    if (!r.ok) {
      setBusy(null);
      setNote(`상품 이미지 불러오기 실패 — ${r.error}`);
      return;
    }
    // 배경제거를 켜도 원본으로도 한 번 더 시도한다 — 누끼가 안 돼도 상품은 나와야 한다.
    const opts = cutout ? ["segment=foreground,format=png", "format=png"] : ["format=png"];
    for (const opt of opts) {
      try {
        const res = await fetch(`/cdn-cgi/image/${opt}/${r.url}`);
        if (!res.ok) continue;
        addImage(URL.createObjectURL(await res.blob()), 0.7, 0.6, 0.62);
        setBusy(null);
        if (cutout && opt === "format=png") setNote("배경제거가 안 돼 원본을 올렸습니다.");
        return;
      } catch {
        /* 다음 방식으로 */
      }
    }
    setBusy(null);
    setNote("상품 이미지를 불러오지 못했습니다.");
  };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = nid();
      setBlocks((bs) => [...bs, { id, type: "logo", x: 0.84, y: 0.1, size: 0.2, src: String(reader.result) }]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
  };
  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));
  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelectedId(null);
  };

  /**
   * 레이어 순서. 그리는 순서가 곧 앞뒤라 배열 순서를 바꾸면 된다(뒤 원소가 위에 그려진다).
   * 인물을 상품 뒤로 보내거나, 문구를 인물 위로 올리는 데 쓴다.
   */
  const move = (id: string, to: "front" | "up" | "down" | "back") => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const next = [...bs];
      const [b] = next.splice(i, 1);
      const j =
        to === "front" ? next.length
        : to === "back" ? 0
        : to === "up" ? Math.min(i + 1, next.length)
        : Math.max(i - 1, 0);
      next.splice(j, 0, b);
      return next;
    });
  };

  /** 선택한 이미지를 캔버스에 꽉 차게 (가로 기준으로 키우고 가운데 정렬) */
  const fitToCanvas = (id: string) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, x: 0.5, y: 0.5, size: 1 } : b)));

  // ── 다운로드 ──
  const preset = THUMBNAIL_PRESETS.find((p) => p.key === presetKey)!;
  const download = async () => {
    const off = document.createElement("canvas");
    off.width = preset.width;
    off.height = preset.height;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    draw(ctx, preset.width, preset.height, true);
    const blob = await new Promise<Blob | null>((res) => off.toBlob(res, "image/png"));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-seller-thumbnail-${preset.key}.png`;
    a.click();
    URL.revokeObjectURL(url);

    // 작업 이력 저장(메타데이터만 — 이미지 업로드는 Supabase Storage 연동 후)
    if (!mock) {
      const r = await saveThumbnailWork({
        ingredient: defaults.ingredient,
        part: defaults.part,
        preset: preset.key,
        blocks: blocks.map((b) => ({ ...b })),
      });
      setSavedNote(r.ok ? "작업 이력에 저장됨" : null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
      {/* 미리보기 캔버스 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <canvas
          ref={canvasRef}
          width={DISPLAY}
          height={DISPLAY}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="touch-none rounded-xl border border-slate-200"
          style={{ width: DISPLAY, height: DISPLAY, cursor: dragRef.current ? "grabbing" : "grab" }}
        />
        <p className="mt-2 text-center text-[11px] text-slate-400">
          블록을 드래그해 배치 · 배경 {bg.label} 테마
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="space-y-4">
        {/* 프리셋 */}
        <Section title="사이즈 프리셋">
          <div className="flex gap-2">
            {THUMBNAIL_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetKey(p.key)}
                className={pill(presetKey === p.key)}
              >
                {p.label}
                <span className="ml-1 text-[10px] opacity-70">
                  {p.width}×{p.height}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {!quota.unlimited && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            오늘 AI 생성{" "}
            <span className="font-semibold text-slate-700">
              {Math.max(quota.limit - quota.used, 0)}회
            </span>{" "}
            남았습니다 (하루 {quota.limit}회 · 자정 초기화). 배경·인물 생성이 각 1회입니다.
          </p>
        )}

        {/* 배경 */}
        <Section title="배경">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={genBackground} disabled={busy !== null} className={btnPrimary}>
              {busy === "bg" ? "생성 중…" : bgImage ? "AI 배경 재생성" : "AI 배경 생성"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBgImage(null);
                setBgSeed((v) => v + 1);
              }}
              className={btn}
            >
              테마 배경 ({bg.label})
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            {defaults.ingredient || "원료"}의 원물 사진을 배경으로 만듭니다(약 20초). 글자는 넣지
            않으니 문구는 아래 텍스트로 올리세요. 키가 없거나 실패하면 테마 배경이 유지됩니다.
          </p>
        </Section>

        {/* 인물·상품 */}
        <Section title="인물 · 상품">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              모델
              <input
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className={`${input} mt-1 w-28`}
                placeholder="40대 남성"
              />
            </label>
            <label className="text-xs text-slate-500">
              차림
              <input
                value={outfit}
                onChange={(e) => setOutfit(e.target.value)}
                className={`${input} mt-1 w-32`}
                placeholder="깔끔한 정장"
              />
            </label>
            <button type="button" onClick={genPerson} disabled={busy !== null} className={btn}>
              {busy === "person" ? "생성 중…" : "+ AI 인물"}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={cutout}
                onChange={(e) => setCutout(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-600"
              />
              배경 제거
            </label>
            <button
              type="button"
              onClick={addProduct}
              disabled={busy !== null || !defaults.productId}
              className={`${btn} disabled:opacity-40`}
              title={
                defaults.productId
                  ? "소싱에서 넘어온 상품의 대표 이미지를 올립니다"
                  : "소싱 화면의 '썸네일 만들기'로 들어오면 상품 이미지를 바로 올릴 수 있습니다"
              }
            >
              {busy === "product" ? "불러오는 중…" : "+ 소싱 상품 이미지"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            인물은 AI가 만든 가상 인물이라 초상권 문제가 없습니다. 상품 이미지는 배경만 지우고
            원본 픽셀은 그대로 둡니다 — AI로 다시 그리면 패키지의 표시사항이 깨집니다.
            배경제거가 안 되면 원본이 그대로 올라갑니다.
          </p>
        </Section>

        {/* 요소 추가 */}
        <Section title="요소 추가">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addText} className={btn}>+ 텍스트</button>
            <button type="button" onClick={addBadge} className={btn}>+ 건강기능식품 배지</button>
            <label className={`${btn} cursor-pointer`}>
              + 로고 업로드
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
          </div>
        </Section>

        {/* 선택 요소 편집 */}
        <Section title="선택 요소">
          {!selected ? (
            <p className="text-xs text-slate-400">캔버스에서 요소를 클릭하면 편집할 수 있습니다.</p>
          ) : (
            <div className="space-y-3">
              {selected.type === "text" && (
                <>
                  <input
                    value={selected.text}
                    onChange={(e) => patch(selected.id, { text: e.target.value })}
                    className={input}
                    placeholder="텍스트 내용"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex flex-1 items-center gap-2 text-xs text-slate-500">
                      크기
                      <input
                        type="range"
                        min={0.03}
                        max={0.18}
                        step={0.005}
                        value={selected.size}
                        onChange={(e) => patch(selected.id, { size: Number(e.target.value) })}
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      색상
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(e) => patch(selected.id, { color: e.target.value })}
                        className="h-7 w-9 rounded border border-slate-200"
                      />
                    </label>
                  </div>
                </>
              )}
              {(selected.type === "badge" || selected.type === "logo") && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    크기
                    <input
                      type="range"
                      min={0.1}
                      /* 상품·인물 이미지는 캔버스를 넘겨 잘라 쓰기도 하므로 1을 넘게 둔다 */
                      max={selected.type === "logo" ? 1.6 : 0.5}
                      step={0.01}
                      value={selected.size}
                      onChange={(e) => patch(selected.id, { size: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="w-10 shrink-0 text-right tabular-nums text-slate-400">
                      {Math.round(selected.size * 100)}%
                    </span>
                  </label>
                  {selected.type === "logo" && (
                    <button type="button" onClick={() => fitToCanvas(selected.id)} className={btn}>
                      ⤢ 꽉 채우기
                    </button>
                  )}
                </div>
              )}

              {/* 레이어 순서 — 인물을 상품 뒤로, 문구를 맨 위로 같은 조정 */}
              <div>
                <span className="mb-1 block text-xs text-slate-500">
                  레이어 순서{" "}
                  <span className="text-slate-400">
                    ({blocks.findIndex((b) => b.id === selected.id) + 1}/{blocks.length}, 클수록 위)
                  </span>
                </span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => move(selected.id, "front")} className={btn}>
                    맨 위
                  </button>
                  <button type="button" onClick={() => move(selected.id, "up")} className={btn}>
                    ↑ 위로
                  </button>
                  <button type="button" onClick={() => move(selected.id, "down")} className={btn}>
                    ↓ 아래로
                  </button>
                  <button type="button" onClick={() => move(selected.id, "back")} className={btn}>
                    맨 아래
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(selected.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                요소 삭제
              </button>
            </div>
          )}
        </Section>

        {note && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            {note}
          </p>
        )}

        {/* 다운로드 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button type="button" onClick={download} className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">
            {preset.label} PNG 다운로드 ({preset.width}×{preset.height})
          </button>
          {savedNote && <p className="mt-2 text-center text-xs text-brand-700">{savedNote}</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{AI_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}

// ── 그리기 헬퍼 (bbox 정규화 반환) ──

function drawText(ctx: CanvasRenderingContext2D, b: TextBlock, W: number, H: number): Box {
  const px = b.size * H;
  ctx.font = `bold ${px}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(b.text || " ").width;
  // 가독성 외곽선
  ctx.lineWidth = px * 0.14;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(b.text, b.x * W, b.y * H);
  ctx.fillStyle = b.color;
  ctx.fillText(b.text, b.x * W, b.y * H);
  const halfW = w / 2 / W;
  const halfH = px * 0.7 / H;
  return { x0: b.x - halfW, y0: b.y - halfH, x1: b.x + halfW, y1: b.y + halfH };
}

function drawBadge(ctx: CanvasRenderingContext2D, b: BadgeBlock, W: number, H: number): Box {
  const bw = b.size * W;
  const bh = bw * 0.34;
  const x = b.x * W - bw / 2;
  const y = b.y * H - bh / 2;
  roundRect(ctx, x, y, bw, bh, bh * 0.28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, bw * 0.02);
  ctx.strokeStyle = "#059669";
  ctx.stroke();
  ctx.fillStyle = "#059669";
  ctx.font = `bold ${bh * 0.44}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("건강기능식품", b.x * W, b.y * H);
  const halfW = bw / 2 / W;
  const halfH = bh / 2 / H;
  return { x0: b.x - halfW, y0: b.y - halfH, x1: b.x + halfW, y1: b.y + halfH };
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  b: LogoBlock,
  W: number,
  H: number,
  img: HTMLImageElement | null,
): Box {
  const w = b.size * W;
  if (img && img.complete && img.naturalWidth > 0) {
    const ratio = img.naturalHeight / img.naturalWidth;
    const h = w * ratio;
    ctx.drawImage(img, b.x * W - w / 2, b.y * H - h / 2, w, h);
    return { x0: b.x - w / 2 / W, y0: b.y - h / 2 / H, x1: b.x + w / 2 / W, y1: b.y + h / 2 / H };
  }
  // 로딩 중 플레이스홀더
  const h = w * 0.4;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, b.x * W - w / 2, b.y * H - h / 2, w, h, 6);
  ctx.fill();
  return { x0: b.x - w / 2 / W, y0: b.y - h / 2 / H, x1: b.x + w / 2 / W, y1: b.y + h / 2 / H };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ── 소소한 UI ──
const btn = "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700";
const btnPrimary = "rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700";
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
function pill(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-500 hover:border-brand-400"
  }`;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2.5 text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}
