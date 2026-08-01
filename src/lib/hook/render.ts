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

const PAD = 72;
const INNER = HOOK_W - PAD * 2;

/** 제품이 놓이는 가운데 밴드 — 텍스트 길이와 무관하게 고정이라 항상 같은 자리에 온다 */
const BAND_TOP = 520;
const BAND_H = 620;

/** 하단 카드 패널의 기본 위치 (사용자가 드래그하면 layout이 이긴다) */
const PANEL_TOP_DEFAULT = 1200;
const PANEL_H = 250;

/**
 * 고를 수 있는 폰트.
 *
 * **캔버스는 이미 로드된 폰트만 그린다.** 없는 폰트를 지정하면 조용히 기본 폰트로
 * 떨어져서 "왜 안 바뀌지"가 된다. 그래서 웹폰트는 앱이 이미 싣는 Pretendard만 두고,
 * 나머지는 OS에 항상 있는 것으로 스택을 짠다.
 */
export const HOOK_FONTS = [
  {
    key: "pretendard",
    label: "프리텐다드",
    stack: `"Pretendard Variable", Pretendard, -apple-system, sans-serif`,
  },
  {
    key: "system",
    label: "시스템 고딕",
    stack: `-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
  },
  { key: "serif", label: "명조", stack: `"Apple SD Gothic Neo", serif` },
  { key: "mono", label: "고정폭", stack: `ui-monospace, Menlo, monospace` },
] as const;

export type HookFontKey = (typeof HOOK_FONTS)[number]["key"];
export type BulletShape = "circle" | "square" | "diamond" | "check" | "none";

export const BULLET_SHAPES: { key: BulletShape; label: string }[] = [
  { key: "circle", label: "● 원" },
  { key: "square", label: "■ 사각" },
  { key: "diamond", label: "◆ 마름모" },
  { key: "check", label: "✓ 체크" },
  { key: "none", label: "없음" },
];

export interface HookStyle {
  font: HookFontKey;
  /** 글자 크기 배율 (0.8~1.3). 레이아웃 밴드는 고정이라 배율로만 조절한다 */
  scale: number;
  /** 본문 글자색. **빈 값이면 톤에 맞춰 자동**(어두운 장=흰색, 밝은 장=검정) */
  textColor: string;
  /** 배지·불릿 강조색. 빈 값이면 자동 */
  accentColor: string;
  bulletShape: BulletShape;
  /** 불릿 크기 배율 (0.6~1.8) */
  bulletScale: number;
}

/**
 * 문구 덩어리의 위치. 정규화 좌표(0~1)라 캔버스 크기가 바뀌어도 그대로 쓴다.
 * `x`는 중심, `y`는 윗변 기준이다.
 *
 * 배지·헤드라인·서브는 **한 덩어리로 움직인다** — 셋의 간격은 디자인이고,
 * 따로 흩어놓게 하면 매번 정렬을 다시 맞춰야 한다.
 */
export interface PageLayout {
  head: { x: number; y: number };
  panel: { x: number; y: number };
}

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  head: { x: 0.5, y: 96 / HOOK_H },
  panel: { x: 0.5, y: PANEL_TOP_DEFAULT / HOOK_H },
};

/** 드래그 히트 판정을 위해 렌더러가 실제로 그린 영역을 돌려준다 */
export interface DrawnBounds {
  head: { x: number; y: number; w: number; h: number };
  panel: { x: number; y: number; w: number; h: number } | null;
}

export const DEFAULT_HOOK_STYLE: HookStyle = {
  font: "pretendard",
  scale: 1,
  textColor: "",
  accentColor: "",
  bulletShape: "circle",
  bulletScale: 1,
};

const fontStack = (key: HookFontKey) =>
  HOOK_FONTS.find((f) => f.key === key)?.stack ?? HOOK_FONTS[0].stack;

/** 불릿 하나를 그린다. 중심 좌표 기준 */
function drawBullet(
  ctx: CanvasRenderingContext2D,
  shape: BulletShape,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  if (shape === "none") return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "square") {
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.2);
    ctx.lineTo(cx + r * 1.2, cy);
    ctx.lineTo(cx, cy + r * 1.2);
    ctx.lineTo(cx - r * 1.2, cy);
    ctx.closePath();
    ctx.fill();
  } else {
    // 체크 — 선으로 그려야 크기를 키워도 뭉개지지 않는다
    ctx.lineWidth = Math.max(2, r * 0.45);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx - r * 0.25, cy + r * 0.7);
    ctx.lineTo(cx + r * 1.1, cy - r * 0.8);
    ctx.stroke();
  }
}

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
  font: string,
): { size: number; lines: string[] } {
  let size = from;
  let lines: string[] = [];
  for (; size >= to; size -= 3) {
    ctx.font = `800 ${size}px ${font}`;
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

export interface RenderInput {
  page: HookPage;
  /**
   * 두 장이 공유하는 씬 (gpt-image-2가 상품 사진으로 만든 완성 이미지).
   * **제품이 이 안에 이미 들어 있다** — 따로 합성하지 않는다.
   */
  background: HTMLImageElement | null;
  /** 규격 한 줄 — 제품 아래에 붙는다 */
  specText: string;
  disclaimer: string;
  /** 0 = 문제 후킹(어두운 톤), 1 = 해결 후킹(밝은 톤) */
  index: 0 | 1;
  style: HookStyle;
  layout: PageLayout;
}

export function renderHookPage(
  canvas: HTMLCanvasElement,
  input: RenderInput,
): DrawnBounds | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = HOOK_W;
  canvas.height = HOOK_H;

  const { page, background, index, style, layout } = input;
  const onDark = index === 0;
  const FONT = fontStack(style.font);
  // 배율은 글자에만 건다. 밴드 좌표는 고정이라 레이아웃이 흔들리지 않는다.
  const px = (n: number) => Math.round(n * style.scale);

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

  // 문구 가독성을 위한 베일.
  //
  // **글자가 놓이는 위·아래만 누른다.** 전체에 균일하게 깔았더니 AI 씬의 원물 소재가
  // 뿌옇게 씻겨 레퍼런스 같은 선명함이 사라졌다. 씬 프롬프트가 이미 위 1/3·아래 1/4을
  // 비우게 돼 있어(image.ts buildScenePrompt) 가운데는 거의 손대지 않아도 된다.
  const veil = ctx.createLinearGradient(0, 0, 0, HOOK_H);
  const top = onDark ? "rgba(15,23,42," : "rgba(255,255,255,";
  veil.addColorStop(0, `${top}${onDark ? 0.9 : 0.88})`);
  veil.addColorStop(0.26, `${top}${onDark ? 0.5 : 0.3})`);
  veil.addColorStop(0.4, `${top}0)`);
  veil.addColorStop(0.72, `${top}0)`);
  veil.addColorStop(0.82, `${top}${onDark ? 0.55 : 0.45})`);
  veil.addColorStop(1, `${top}${onDark ? 0.9 : 0.85})`);
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, HOOK_W, HOOK_H);

  // 색을 지정하지 않으면 장의 톤에 맞춰 자동으로 고른다.
  const fg = style.textColor || (onDark ? "#ffffff" : "#0f172a");
  const dim = style.textColor || (onDark ? "rgba(255,255,255,0.75)" : "#475569");
  const accent = style.accentColor || (onDark ? "#34d399" : "#059669");

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const headX = layout.head.x * HOOK_W;
  const headTop = layout.head.y * HOOK_H;
  let y = headTop;

  // ── 배지 ──
  if (page.badge) {
    ctx.font = `700 ${px(30)}px ${FONT}`;
    const w = ctx.measureText(page.badge).width + 50;
    ctx.fillStyle = accent;
    const badgeH = px(60);
    roundRect(ctx, headX - w / 2, y, w, badgeH, badgeH / 2);
    ctx.fill();
    ctx.fillStyle = onDark ? "#06281c" : "#ffffff";
    ctx.fillText(page.badge, headX, y + px(16));
    y += badgeH + 28;
  }

  // ── 헤드라인 — 2줄 안에 들어가게 크기를 맞춘다 ──
  if (page.headline) {
    const { size, lines } = fitLines(ctx, page.headline, INNER, 2, px(78), px(44), FONT);
    ctx.fillStyle = fg;
    for (const line of lines) {
      ctx.fillText(line, headX, y);
      y += size * 1.28;
    }
    y += 10;
  }

  // ── 보조 문구 ──
  if (page.sub) {
    ctx.font = `500 ${px(32)}px ${FONT}`;
    ctx.fillStyle = dim;
    for (const line of wrap(ctx, page.sub, INNER)) {
      ctx.fillText(line, headX, y);
      y += px(48);
    }
  }

  // ── 규격 (제품 바로 아래) ──
  if (input.specText) {
    ctx.font = `700 ${px(32)}px ${FONT}`;
    ctx.fillStyle = onDark ? "rgba(255,255,255,0.9)" : "#0f172a";
    ctx.fillText(input.specText, HOOK_W / 2, BAND_TOP + BAND_H - 42);
  }

  // ── 하단 카드 패널 (points) ──
  const pts = page.points.slice(0, 3);
  const PANEL_TOP = layout.panel.y * HOOK_H;
  const panelX = layout.panel.x * HOOK_W - INNER / 2;
  if (pts.length) {
    ctx.fillStyle = onDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)";
    roundRect(ctx, panelX, PANEL_TOP, INNER, PANEL_H, 28);
    ctx.fill();

    const colW = INNER / pts.length;
    pts.forEach((p, i) => {
      const cx = panelX + colW * i + colW / 2;
      // 칸 구분선
      if (i > 0) {
        ctx.strokeStyle = onDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + colW * i, PANEL_TOP + 42);
        ctx.lineTo(panelX + colW * i, PANEL_TOP + PANEL_H - 42);
        ctx.stroke();
      }
      drawBullet(ctx, style.bulletShape, cx, PANEL_TOP + 64, 11 * style.bulletScale, accent);

      ctx.font = `700 ${px(31)}px ${FONT}`;
      ctx.fillStyle = fg;
      let ly = PANEL_TOP + 102;
      for (const line of wrap(ctx, p, colW - 32).slice(0, 3)) {
        ctx.fillText(line, cx, ly);
        ly += px(40);
      }
    });
  }

  // ── AI 고지 (광고 심의 대비) ──
  ctx.font = `400 21px ${FONT}`;
  ctx.fillStyle = onDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.45)";
  ctx.fillText(input.disclaimer, HOOK_W / 2, HOOK_H - 56);

  ctx.textAlign = "left";

  // 드래그 히트 판정용. 머리 덩어리는 실제로 그린 높이(y - headTop)를 쓴다.
  return {
    head: { x: headX - INNER / 2, y: headTop, w: INNER, h: Math.max(y - headTop, 60) },
    panel: pts.length ? { x: panelX, y: PANEL_TOP, w: INNER, h: PANEL_H } : null,
  };
}
