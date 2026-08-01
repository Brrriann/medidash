/**
 * 썸네일 배경 생성 (docs/UI-PLAN.md §7 프롬프트 템플릿의 "부위 관련 컬러")
 *
 * 테스트 버전: 부위/계통 키워드로 테마 그라디언트를 결정적으로 생성한다(재생성 시 변형).
 * 실서비스(W3): AI 이미지 API(`src/lib/ai/image.ts`)로 교체 — 이 파일은 mock 배경 폴백.
 */

export interface GradientSpec {
  kind: "gradient";
  c1: string;
  c2: string;
  /** 도(degree) */
  angle: number;
  label: string;
}

/** 부위/계통 키워드 → 팔레트 (배경 색은 부위 연상 컬러) */
const PALETTES: { keys: string[]; c1: string; c2: string; label: string }[] = [
  { keys: ["눈", "감각", "시력"], c1: "#0ea5e9", c2: "#6366f1", label: "블루" },
  { keys: ["간", "소화", "장", "위", "숙취"], c1: "#10b981", c2: "#84cc16", label: "그린" },
  { keys: ["관절", "뼈", "근육", "근골격"], c1: "#f59e0b", c2: "#f97316", label: "앰버" },
  { keys: ["면역", "항산화", "환절기"], c1: "#ef4444", c2: "#f59e0b", label: "레드오렌지" },
  { keys: ["수면", "스트레스", "신경", "뇌", "기억"], c1: "#6366f1", c2: "#8b5cf6", label: "인디고" },
  { keys: ["혈행", "혈압", "혈중지질", "심장", "순환"], c1: "#0d9488", c2: "#0ea5e9", label: "틸" },
  { keys: ["전립선", "남성", "정력"], c1: "#334155", c2: "#0ea5e9", label: "슬레이트블루" },
  { keys: ["여성", "갱년기", "피부"], c1: "#ec4899", c2: "#f97316", label: "핑크" },
  { keys: ["다이어트", "체지방", "혈당"], c1: "#14b8a6", c2: "#22c55e", label: "민트" },
];

/* 부위가 안 잡힐 때 쓰는 기본값이라 브랜드색을 따라간다(brand-500 → brand-800).
   위의 부위별 팔레트는 브랜드가 아니라 부위의 뜻을 담은 색이라 그대로 둔다. */
const DEFAULT_PALETTE = { c1: "#3a6089", c2: "#152d48", label: "브랜드" };

const ANGLES = [135, 115, 160, 95, 180];

/**
 * 부위 텍스트 + seed로 배경 그라디언트 결정. seed를 바꾸면(재생성) 각도·명암이 달라진다.
 */
export function generateBackground(part: string, seed: number): GradientSpec {
  const key = (part ?? "").replace(/\s+/g, "");
  const pal =
    PALETTES.find((p) => p.keys.some((k) => key.includes(k))) ?? DEFAULT_PALETTE;

  const s = Math.abs(Math.trunc(seed));
  const angle = ANGLES[s % ANGLES.length];
  // 재생성 변형: 짝/홀 seed에 따라 두 색 순서 스왑 + 명도 살짝 조정
  const swap = s % 2 === 1;
  const c1 = swap ? pal.c2 : pal.c1;
  const c2 = swap ? pal.c1 : pal.c2;
  return { kind: "gradient", c1, c2, angle, label: pal.label };
}
