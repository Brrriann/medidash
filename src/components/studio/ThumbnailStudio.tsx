"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THUMBNAIL_PRESETS, AI_DISCLAIMER } from "@/lib/constants";
import { generateBackground, type GradientSpec } from "@/lib/thumbnail/backgrounds";
import { saveThumbnailWork } from "@/app/(dashboard)/studio/actions";

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
}: {
  defaults: { ingredient: string; part: string };
  mock: boolean;
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
      img.src = src;
      imgCache.current.set(src, img);
      return null;
    },
    [],
  );

  /** 캔버스 1회 렌더 — forExport면 선택 외곽선 생략, bbox 기록 안 함 */
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, forExport: boolean) => {
      // 배경 그라디언트
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
    [bg, blocks, selectedId, getImg],
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
    a.download = `medidash-thumbnail-${preset.key}.png`;
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

        {/* AI 배경 */}
        <Section title="AI 배경">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setBgSeed((s) => s + 1)} className={btnPrimary}>
              배경 {bgSeed === 0 ? "생성" : "재생성"}
            </button>
            <span className="text-[11px] text-slate-400">
              부위: {defaults.part || "기본"} → {bg.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            테스트 버전은 부위 테마 그라디언트를 생성합니다. 실서비스에선 이미지 생성 API로 교체됩니다.
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
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  크기
                  <input
                    type="range"
                    min={0.1}
                    max={0.5}
                    step={0.01}
                    value={selected.size}
                    onChange={(e) => patch(selected.id, { size: Number(e.target.value) })}
                    className="flex-1"
                  />
                </label>
              )}
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
