import type { HookPage } from "@/lib/ai/hook";

/**
 * 후킹페이지 캔버스 렌더링 (브라우저 전용).
 *
 * **레이아웃은 상세페이지 관행을 따른다** — 위에 헤드라인, **가운데 제품이 크게**,
 * 아래에 원료·특징 카드. 제품을 남는 공간에 끼워 넣으면 작아져서 후킹이 안 된다.
 *
 *   ┌──────────────┐
 *   │ 배지 / 헤드라인 / 서브 │  상단 텍스트 블록
 *   ├──────────────┤
 *   │   [ 제품 이미지 ]    │  ← 가운데 고정 밴드, 주인공
 *   ├──────────────┤
 *   │ [카드][카드][카드]  │  하단 패널 (points)
 *   └──────────────┘
 *
 * **드래그 편집이 아니라 고정 템플릿인 이유**: 셀러가 원하는 건 배치가 아니라 "문구만
 * 채우면 나오는 결과물"이다. 자유 배치를 주면 2장 만드는 데 시간이 더 걸린다.
 *
 * 두 장은 톤으로 나눈다 — 1장(문제 후킹)은 어둡게, 2장(해결 후킹)은 밝게.
 */

/**
 * 캔버스 크기.
 *
 * gpt-image-1의 세로 사이즈(1024×1536)와 **똑같이** 맞춘다. AI 배경이 리샘플링 없이
 * 1:1로 들어가고, 레퍼런스로 받은 상세페이지 이미지의 세로 비율과도 거의 같다.
 */
export const HOOK_W = 1024;
export const HOOK_H = 1536;

const FONT = `"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif`;
const PAD = 72;
const INNER = HOOK_W - PAD * 2;

/** 제품이 놓이는 가운데 밴드 — 텍스트 길이와 무관하게 고정이라 항상 같은 자리에 온다 */
const BAND_TOP = 520;
const BAND_H = 620;

/** 하단 카드 패널 */
const PANEL_TOP = 1200;
const PANEL_H = 250;

/**
 * 글자를 폭에 맞춰 줄바꿈. 한글은 띄어쓰기 없이도 이어져 단어 경계로 자를 수 없어
 * 글자 단위로 자른다.
 *
 * 마지막 줄에 한 글자만 남는 건 따로 막는다 — "…개운하지 않다 / 면"처럼 조사 한 글자가
 * 혼자 떨어지면 눈에 확 띄게 어색하다. 앞 줄에서 한 글자를 내려 두 글자로 만든다.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);

  const last = lines.at(-1);
  if (lines.length >= 2 && last && [...last].length === 1) {
    const prev = [...lines[lines.length - 2]];
    if (prev.length > 1) {
      lines[lines.length - 1] = prev.pop()! + last;
      lines[lines.length - 2] = prev.join("");
    }
  }
  return lines;
}

/**
 * 최대 줄 수 안에 들어갈 때까지 글자 크기를 줄인다.
 * 긴 헤드라인이 제품 밴드를 밀어내면 레이아웃이 통째로 무너지므로, 밀어내는 대신 줄인다.
 */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  from: number,
  to: number,
): { size: number; lines: string[] } {
  let size = from;
  let lines: string[] = [];
  for (; size >= to; size -= 3) {
    ctx.font = `800 ${size}px ${FONT}`;
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) break;
  }
  return { size, lines };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 비율 유지하며 캔버스를 꽉 채운다 (CSS object-fit: cover) */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
) {
  const scale = Math.max(HOOK_W / iw, HOOK_H / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, (HOOK_W - w) / 2, (HOOK_H - h) / 2, w, h);
}

/** 밴드 안에 비율 유지하며 최대한 크게 (CSS object-fit: contain) */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  top: number,
  height: number,
) {
  const s = Math.min(INNER / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, (HOOK_W - w) / 2, top + (height - h) / 2, w, h);
}

export interface RenderInput {
  page: HookPage;
  /** 두 장이 공유하는 배경 (AI 1회 생성) */
  background: HTMLImageElement | null;
  product: HTMLImageElement | null;
  /** 규격 한 줄 — 제품 아래에 붙는다 */
  specText: string;
  disclaimer: string;
  /** 0 = 문제 후킹(어두운 톤), 1 = 해결 후킹(밝은 톤) */
  index: 0 | 1;
}

export function renderHookPage(canvas: HTMLCanvasElement, input: RenderInput) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = HOOK_W;
  canvas.height = HOOK_H;

  const { page, background, product, index } = input;
  const onDark = index === 0;

  // ── 배경 ──
  if (background?.complete && background.naturalWidth) {
    drawCover(ctx, background, background.naturalWidth, background.naturalHeight);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, HOOK_H);
    g.addColorStop(0, onDark ? "#1e293b" : "#f8fafc");
    g.addColorStop(1, onDark ? "#0f172a" : "#e2e8f0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, HOOK_W, HOOK_H);
  }

  // 문구 가독성을 위한 베일. 제품이 놓이는 가운데는 덜 눌러 사진이 살아 있게 한다.
  const veil = ctx.createLinearGradient(0, 0, 0, HOOK_H);
  if (onDark) {
    veil.addColorStop(0, "rgba(15,23,42,0.88)");
    veil.addColorStop(0.42, "rgba(15,23,42,0.62)");
    veil.addColorStop(1, "rgba(15,23,42,0.9)");
  } else {
    veil.addColorStop(0, "rgba(255,255,255,0.93)");
    veil.addColorStop(0.42, "rgba(255,255,255,0.62)");
    veil.addColorStop(1, "rgba(255,255,255,0.95)");
  }
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, HOOK_W, HOOK_H);

  const fg = onDark ? "#ffffff" : "#0f172a";
  const dim = onDark ? "rgba(255,255,255,0.75)" : "#475569";
  const accent = onDark ? "#34d399" : "#059669";

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  let y = 96;

  // ── 배지 ──
  if (page.badge) {
    ctx.font = `700 30px ${FONT}`;
    const w = ctx.measureText(page.badge).width + 50;
    ctx.fillStyle = accent;
    roundRect(ctx, (HOOK_W - w) / 2, y, w, 60, 30);
    ctx.fill();
    ctx.fillStyle = onDark ? "#06281c" : "#ffffff";
    ctx.fillText(page.badge, HOOK_W / 2, y + 16);
    y += 88;
  }

  // ── 헤드라인 — 2줄 안에 들어가게 크기를 맞춘다 ──
  if (page.headline) {
    const { size, lines } = fitLines(ctx, page.headline, INNER, 2, 78, 48);
    ctx.fillStyle = fg;
    for (const line of lines) {
      ctx.fillText(line, HOOK_W / 2, y);
      y += size * 1.28;
    }
    y += 10;
  }

  // ── 보조 문구 ──
  if (page.sub) {
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = dim;
    for (const line of wrap(ctx, page.sub, INNER)) {
      ctx.fillText(line, HOOK_W / 2, y);
      y += 48;
    }
  }

  // ── 제품 이미지 — 가운데 고정 밴드의 주인공 ──
  const hasProduct = !!(product?.complete && product.naturalWidth);
  if (hasProduct) {
    // 밝은 톤에서는 제품 뒤에 옅은 원형 광을 깔아 배경과 분리한다.
    if (!onDark) {
      const r = Math.min(INNER, BAND_H) / 2;
      const glow = ctx.createRadialGradient(
        HOOK_W / 2, BAND_TOP + BAND_H / 2, 0,
        HOOK_W / 2, BAND_TOP + BAND_H / 2, r,
      );
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, BAND_TOP, HOOK_W, BAND_H);
    }
    drawContain(ctx, product!, BAND_TOP, BAND_H - (input.specText ? 56 : 0));
  }

  // ── 규격 (제품 바로 아래) ──
  if (input.specText) {
    ctx.font = `700 32px ${FONT}`;
    ctx.fillStyle = onDark ? "rgba(255,255,255,0.9)" : "#0f172a";
    ctx.fillText(input.specText, HOOK_W / 2, BAND_TOP + BAND_H - 42);
  }

  // ── 하단 카드 패널 (points) ──
  const pts = page.points.slice(0, 3);
  if (pts.length) {
    ctx.fillStyle = onDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)";
    roundRect(ctx, PAD, PANEL_TOP, INNER, PANEL_H, 28);
    ctx.fill();

    const colW = INNER / pts.length;
    pts.forEach((p, i) => {
      const cx = PAD + colW * i + colW / 2;
      // 칸 구분선
      if (i > 0) {
        ctx.strokeStyle = onDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD + colW * i, PANEL_TOP + 42);
        ctx.lineTo(PAD + colW * i, PANEL_TOP + PANEL_H - 42);
        ctx.stroke();
      }
      // 아이콘 자리 — 원료 이미지는 아직 없어 점으로 대신한다
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, PANEL_TOP + 64, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `700 31px ${FONT}`;
      ctx.fillStyle = fg;
      let ly = PANEL_TOP + 102;
      for (const line of wrap(ctx, p, colW - 32).slice(0, 3)) {
        ctx.fillText(line, cx, ly);
        ly += 40;
      }
    });
  }

  // ── AI 고지 (광고 심의 대비) ──
  ctx.font = `400 21px ${FONT}`;
  ctx.fillStyle = onDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.45)";
  ctx.fillText(input.disclaimer, HOOK_W / 2, HOOK_H - 56);

  ctx.textAlign = "left";
}
