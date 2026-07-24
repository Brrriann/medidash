/**
 * 규칙 기반 상품명·태그 생성 (docs/SPEC.md §6.4 · docs/UI-PLAN.md §7)
 *
 * AI 키 없이 동작하는 결정적 생성기 — 테스트 버전에서 바로 사용.
 * (W3에서 AI 어댑터 연동 시 이 결과를 시드/폴백으로 활용하고, AI 출력도 sanitize+scoreExposure를 거친다.)
 *
 * 상품명: 플랫폼별 요소 순서로 3~5안, 노출도 상/중/하 뱃지.
 * 태그 20개: 증상5 · 원료(한/영)5 · 부위효능5 · 대상군3 · 계절2.
 */
import { TAXONOMY } from "@/lib/taxonomy/data";
import { SAMPLE_INGREDIENTS } from "@/lib/data/sample-ingredients";
import { sanitize, hasBannedTerms } from "./compliance";
import { scoreExposure, type ExposureFactors } from "./scoring";
import type { Platform, TitleInput, TitleTagsResult, TitleVariant } from "./types";

const TARGET_TAGS = ["4050영양제", "직장인", "부모님선물"];
const SEASON_TAGS = ["환절기", "명절선물"];
const FILLER_TAGS = ["건강기능식품", "영양제", "건강관리", "데일리", "홈케어", "건강챙기기", "가정건강"];

export function generateTitleTags(input: TitleInput): TitleTagsResult {
  const ingredient = input.ingredient.trim();
  const bodyPart = (input.bodyPart ?? "").trim();
  const brand = (input.brand ?? "").trim();
  const spec = (input.spec ?? "").trim();
  const bodyEffect = bodyPart.replace(/\s+/g, ""); // "눈 건강" → "눈건강"

  const rawTitles = buildTitles({ ingredient, bodyEffect, brand, spec, platform: input.platform });
  const rawTags = buildTags(ingredient, bodyPart, bodyEffect);

  // 금지어 검사·치환 (입력 특징 + 생성 결과)
  let sanitized = hasBannedTerms(
    [input.productHint, bodyPart, ingredient].filter(Boolean).join(" "),
  );
  const titles: TitleVariant[] = rawTitles.map((t) => {
    const s = sanitize(t.text);
    if (s.changed) sanitized = true;
    return { text: s.text, exposure: t.exposure };
  });
  const tags = dedupePad(
    rawTags.map((tag) => {
      const s = sanitize(tag);
      if (s.changed) sanitized = true;
      return s.text;
    }),
    20,
  );

  return { titles, tags, sanitized, source: "rule" };
}

// ── 상품명 ─────────────────────────────────────────────────────

/** 플랫폼별 요소 순서로 렌더 (빈 요소는 생략) */
function render(
  platform: Platform,
  parts: { brand: string; ingredient: string; bodyEffect: string; spec: string },
): string {
  // 쿠팡: 브랜드 + 원료 + 효능 + 규격 / 스마트스토어: 원료 + 효능 + 브랜드 + 규격(키워드 우선)
  const order: string[] =
    platform === "coupang"
      ? [parts.brand, parts.ingredient, parts.bodyEffect, parts.spec]
      : [parts.ingredient, parts.bodyEffect, parts.brand, parts.spec];
  return order.filter((s) => s.trim().length > 0).join(" ").replace(/\s{2,}/g, " ").trim();
}

function buildTitles(el: {
  ingredient: string;
  bodyEffect: string;
  brand: string;
  spec: string;
  platform: Platform;
}): TitleVariant[] {
  const { ingredient, bodyEffect, brand, spec, platform } = el;

  // 요소 포함 패턴 (원료는 항상 포함) — 완성도 높은 순
  const patterns: { brand: boolean; bodyEffect: boolean; spec: boolean }[] = [
    { brand: true, bodyEffect: true, spec: true },
    { brand: false, bodyEffect: true, spec: true },
    { brand: true, bodyEffect: false, spec: true },
    { brand: false, bodyEffect: true, spec: false },
    { brand: false, bodyEffect: false, spec: true },
  ];

  const seen = new Set<string>();
  const out: TitleVariant[] = [];
  for (const p of patterns) {
    const parts = {
      brand: p.brand ? brand : "",
      ingredient,
      bodyEffect: p.bodyEffect ? bodyEffect : "",
      spec: p.spec ? spec : "",
    };
    const text = render(platform, parts);
    if (!text || seen.has(text)) continue;
    seen.add(text);

    const factors: ExposureFactors = {
      ingredient: ingredient.length > 0,
      bodyPart: parts.bodyEffect.length > 0,
      brand: parts.brand.length > 0,
      spec: parts.spec.length > 0,
    };
    out.push({ text, exposure: scoreExposure(factors) });
    if (out.length >= 5) break;
  }
  return out;
}

// ── 태그 ───────────────────────────────────────────────────────

function buildTags(ingredient: string, bodyPart: string, bodyEffect: string): string[] {
  const symptoms = findSymptoms(bodyPart).slice(0, 5); // 증상 5
  const ingredientTags = ingredientVariants(ingredient).slice(0, 5); // 원료 한/영 5
  // 부위·효능 5 — "건강"이 이미 붙은 경우 중복("눈건강건강") 방지
  const effectBase = bodyEffect.replace(/건강$/, "");
  const effectTags = bodyEffect
    ? [bodyEffect, `${effectBase}케어`, `${effectBase}영양제`, `${effectBase}관리`, "건강기능식품"]
    : [`${ingredient}영양제`, "건강기능식품", "영양제", "건강관리", "데일리"];

  return [...symptoms, ...ingredientTags, ...effectTags.slice(0, 5), ...TARGET_TAGS, ...SEASON_TAGS];
}

/** bodyPart(중분류명/증상/자유어)로 관련 증상 키워드 조회 */
function findSymptoms(bodyPart: string): string[] {
  if (!bodyPart) return [];
  const key = bodyPart.replace(/\s+/g, "");
  for (const cat of TAXONOMY) {
    for (const sub of cat.subcategories) {
      const nameMatch = sub.name.replace(/\s+/g, "") === key || sub.name.includes(bodyPart);
      const symptomMatch = sub.symptoms.some((s) => s.replace(/\s+/g, "") === key);
      if (nameMatch || symptomMatch) return sub.symptoms;
    }
  }
  return [];
}

/** 원료명 한/영 변형 (사전 별칭 활용) */
function ingredientVariants(ingredient: string): string[] {
  const variants = new Set<string>([ingredient]);
  // 공백 분해 (예: "루테인 지아잔틴" → 루테인, 지아잔틴)
  for (const w of ingredient.split(/\s+/)) if (w.length >= 2) variants.add(w);
  // 샘플 사전에서 별칭(영문 포함) 보강
  const dict = SAMPLE_INGREDIENTS.find(
    (i) => i.name === ingredient || ingredient.includes(i.name) || i.name.includes(ingredient),
  );
  if (dict) for (const a of dict.aliases) variants.add(a);
  return [...variants];
}

/** 중복 제거 후 정확히 n개로 맞춤 (부족분은 필러로 채움) */
function dedupePad(tags: string[], n: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...tags, ...FILLER_TAGS]) {
    const tag = t.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= n) break;
  }
  // 그래도 부족하면 번호 필러 (드묾)
  let i = 1;
  while (out.length < n) {
    const tag = `건강영양제${i++}`;
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out.slice(0, n);
}
