"use client";

import type { BodyCategory } from "@/lib/taxonomy/types";

/**
 * 인체 인터랙티브 지도 (SVG 벡터, 단일 중성 실루엣).
 * 대분류의 svg_region 값으로 데이터 기반 렌더 — REGION_GEOMETRY에 정의된 영역만
 * 실루엣 위 클릭 영역이 되고, 'chip'이거나 미정의 영역은 부모가 라벨 칩으로 배치한다.
 */

type ShapeDef =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: "path"; d: string };

const REGION_GEOMETRY: Record<string, ShapeDef[]> = {
  /** 모발 — 머리 위 크레센트 */
  hair: [{ kind: "path", d: "M 90 46 A 34 34 0 0 1 150 46 Q 120 60 90 46 Z" }],
  /** 신경계/뇌 — 이마·두정부 */
  head: [{ kind: "ellipse", cx: 120, cy: 60, rx: 23, ry: 13 }],
  /** 감각계 — 눈·안면부 */
  face: [{ kind: "ellipse", cx: 120, cy: 81, rx: 19, ry: 12 }],
  /** 호흡기계 — 좌우 폐 */
  lungs: [
    { kind: "ellipse", cx: 96, cy: 158, rx: 15, ry: 23 },
    { kind: "ellipse", cx: 144, cy: 158, rx: 15, ry: 23 },
  ],
  /** 순환계 — 심장 */
  heart: [
    {
      kind: "path",
      d: "M 120 144 c 7 -8 19 -3 18 8 c -1 9 -10 14 -18 20 c -8 -6 -17 -11 -18 -20 c -1 -11 11 -16 18 -8 Z",
    },
  ],
  /** 소화·대사계 — 복부 */
  abdomen: [{ kind: "rect", x: 88, y: 196, width: 64, height: 44, rx: 14 }],
  /** 생식·비뇨계 — 골반부 */
  pelvis: [{ kind: "path", d: "M 90 246 h 60 l 5 18 q -35 17 -70 0 Z" }],
  /** 근골격계 — 어깨·팔꿈치·무릎 관절 */
  joints: [
    { kind: "circle", cx: 76, cy: 124, r: 9 },
    { kind: "circle", cx: 164, cy: 124, r: 9 },
    { kind: "circle", cx: 60, cy: 186, r: 7 },
    { kind: "circle", cx: 180, cy: 186, r: 7 },
    { kind: "circle", cx: 103, cy: 352, r: 9 },
    { kind: "circle", cx: 137, cy: 352, r: 9 },
  ],
};

/** 실루엣 위에 그릴 수 있는 영역 id 목록 (이 외는 라벨 칩으로) */
export const MAPPED_REGIONS = Object.keys(REGION_GEOMETRY);

function Shape({ def }: { def: ShapeDef }) {
  switch (def.kind) {
    case "circle":
      return <circle cx={def.cx} cy={def.cy} r={def.r} />;
    case "ellipse":
      return <ellipse cx={def.cx} cy={def.cy} rx={def.rx} ry={def.ry} />;
    case "rect":
      return (
        <rect x={def.x} y={def.y} width={def.width} height={def.height} rx={def.rx} />
      );
    case "path":
      return <path d={def.d} />;
  }
}

interface BodyMapSvgProps {
  categories: BodyCategory[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

export function BodyMapSvg({ categories, selectedSlug, onSelect }: BodyMapSvgProps) {
  const mapped = categories.filter((c) => REGION_GEOMETRY[c.svgRegion]);

  return (
    <svg
      viewBox="0 0 240 500"
      role="img"
      aria-label="인체 지도 — 계통을 클릭해 탐색"
      className="mx-auto h-full max-h-[520px] w-auto select-none"
    >
      {/* ── 기본 실루엣 (비인터랙티브) ── */}
      <g className="fill-slate-200 stroke-slate-300" strokeWidth="1">
        <circle cx="120" cy="64" r="34" /> {/* 머리 */}
        <rect x="108" y="94" width="24" height="22" rx="8" /> {/* 목 */}
        <path
          d="M 74 116 Q 120 102 166 116 L 172 202 Q 172 242 158 254 L 156 292 Q 120 306 84 292 L 82 254 Q 68 242 68 202 Z"
          /* 몸통 */
        />
        <rect x="46" y="124" width="18" height="120" rx="9" transform="rotate(7 55 184)" /> {/* 왼팔 */}
        <rect x="176" y="124" width="18" height="120" rx="9" transform="rotate(-7 185 184)" /> {/* 오른팔 */}
        <rect x="90" y="290" width="26" height="172" rx="13" /> {/* 왼다리 */}
        <rect x="124" y="290" width="26" height="172" rx="13" /> {/* 오른다리 */}
        <ellipse cx="100" cy="468" rx="16" ry="8" /> {/* 왼발 */}
        <ellipse cx="140" cy="468" rx="16" ry="8" /> {/* 오른발 */}
      </g>

      {/* ── 인터랙티브 영역 (데이터 기반) ── */}
      {mapped.map((cat) => {
        const selected = cat.slug === selectedSlug;
        return (
          <g
            key={cat.slug}
            role="button"
            tabIndex={0}
            aria-label={cat.name}
            aria-pressed={selected}
            onClick={() => onSelect(cat.slug)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(cat.slug);
              }
            }}
            className={`cursor-pointer outline-none transition-colors ${
              selected
                ? "fill-brand-500/85 stroke-brand-700"
                : "fill-brand-300/45 stroke-brand-400/60 hover:fill-brand-400/70 focus-visible:fill-brand-400/70"
            }`}
            strokeWidth="1.5"
          >
            <title>{cat.name}</title>
            {REGION_GEOMETRY[cat.svgRegion].map((def, i) => (
              <Shape key={i} def={def} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
