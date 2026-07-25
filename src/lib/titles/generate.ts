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
import { scoreExposure, coverageOf, type ExposureFactors } from "./scoring";
import { usableRelated } from "./related";
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

  // 네이버 실측 연관어 중 셀러가 따라 써도 되는 것만 (타사 브랜드·제형어 제외)
  const related = input.keywordStat
    ? usableRelated(input.keywordStat.related, ingredient)
    : [];
  const relatedTerms = related.map((r) => r.term);

  const rawTitles = buildTitles({
    ingredient, bodyEffect, brand, spec, platform: input.platform, relatedTerms,
  });
  const rawTags = buildTags(ingredient, bodyPart, bodyEffect, relatedTerms);

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

  return {
    titles,
    tags,
    sanitized,
    source: "rule",
    keywordStat: input.keywordStat ?? null,
    usableRelated: related,
  };
}

// ── 상품명 ─────────────────────────────────────────────────────

/** 플랫폼별 요소 순서로 렌더 (빈 요소는 생략) */
function render(
  platform: Platform,
  parts: {
    brand: string;
    ingredient: string;
    /** 시장 연관어 — 원료 바로 뒤가 가장 자연스럽다 ("루테인 지아잔틴 …") */
    keywords: string;
    bodyEffect: string;
    spec: string;
  },
): string {
  // 쿠팡: 브랜드 + 원료 + 효능 + 규격 / 스마트스토어: 원료 + 효능 + 브랜드 + 규격(키워드 우선)
  const order: string[] =
    platform === "coupang"
      ? [parts.brand, parts.ingredient, parts.keywords, parts.bodyEffect, parts.spec]
      : [parts.ingredient, parts.keywords, parts.bodyEffect, parts.brand, parts.spec];

  // 앞에 이미 나온 말은 다시 붙이지 않는다.
  // 연관어 "간건강"과 부위 "간"이 겹쳐 "… 간건강 간 60캡슐"이 되는 걸 막는다.
  const out: string[] = [];
  let acc = "";
  for (const seg of order) {
    const s = seg.trim();
    if (!s) continue;
    const words = s.split(/\s+/).filter((w) => !acc.includes(w));
    if (!words.length) continue;
    out.push(words.join(" "));
    acc += ` ${words.join(" ")}`;
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

function buildTitles(el: {
  ingredient: string;
  bodyEffect: string;
  brand: string;
  spec: string;
  platform: Platform;
  relatedTerms: string[];
}): TitleVariant[] {
  const { ingredient, bodyEffect, brand, spec, platform, relatedTerms } = el;

  // 상위 노출 상품이 실제로 쓰는 어휘 2개까지 상품명에 끼워넣는다.
  // 이게 없으면 생성기가 "당신 상품명은 중입니다"라고 평가만 하고 개선안을 못 준다.
  // 예: 루테인 시장 표준은 "루테인 지아잔틴"인데 원료만 넣으면 검색에 안 걸린다.
  const kw = relatedTerms.slice(0, 2).join(" ");

  // 요소 포함 패턴 (원료는 항상 포함) — 완성도 높은 순.
  // 연관어를 넣은 안을 앞에 둬서, 셀러가 첫 안을 그대로 써도 노출이 되게 한다.
  const withKw = kw ? [
    { keywords: true, brand: true, bodyEffect: true, spec: true },
    { keywords: true, brand: false, bodyEffect: true, spec: true },
  ] : [];
  const patterns: { keywords?: boolean; brand: boolean; bodyEffect: boolean; spec: boolean }[] = [
    ...withKw,
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
      keywords: p.keywords ? kw : "",
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
      // 상위 노출 상품이 쓰는 어휘를 이 안이 얼마나 담았는지 (실측 없으면 undefined)
      relatedCoverage: coverageOf(text, relatedTerms, ingredient),
    };
    out.push({ text, exposure: scoreExposure(factors) });
    if (out.length >= 5) break;
  }
  return out;
}

// ── 태그 ───────────────────────────────────────────────────────

function buildTags(
  ingredient: string,
  bodyPart: string,
  bodyEffect: string,
  relatedTerms: string[],
): string[] {
  const symptoms = findSymptoms(bodyPart).slice(0, 5); // 증상 5
  const ingredientTags = ingredientVariants(ingredient).slice(0, 5); // 원료 한/영 5
  // 부위·효능 5 — "건강"이 이미 붙은 경우 중복("눈건강건강") 방지
  const effectBase = bodyEffect.replace(/건강$/, "");
  const ruleEffect = bodyEffect
    ? [bodyEffect, `${effectBase}케어`, `${effectBase}영양제`, `${effectBase}관리`, "건강기능식품"]
    : [`${ingredient}영양제`, "건강기능식품", "영양제", "건강관리", "데일리"];
  // 네이버 실측 연관어가 있으면 하드코딩 효능어보다 앞세운다 — 실제 시장 어휘가 더 정확하다.
  const effectTags = [...relatedTerms, ...ruleEffect].slice(0, 5);

  // 뒤에 연관어를 한 번 더 붙여, 중복으로 빈 자리가 생기면 무의미한 필러 대신 실측어가 채우게 한다.
  return [
    ...symptoms, ...ingredientTags, ...effectTags,
    ...TARGET_TAGS, ...SEASON_TAGS, ...relatedTerms,
  ];
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

// ── AI 제안 병합 ────────────────────────────────────────────────
// AI는 후보 문자열만 낸다. 등급과 금지어 처리는 규칙 기반과 **똑같은 잣대**로 여기서 한다.
// AI에게 등급을 맡기면 근거 없는 숫자가 되고, 금지어 판정을 맡기면 광고법 리스크를
// 모델 재량에 넘기게 된다.

const normText = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** AI가 만든 상품명을 규칙 기반과 동일한 기준으로 채점한다 (금지어 치환 포함). */
export function scoreExternalTitles(
  texts: string[],
  input: TitleInput,
  relatedTerms: string[],
): { variants: TitleVariant[]; sanitized: boolean } {
  const ingredient = input.ingredient.trim();
  const bodyEffect = (input.bodyPart ?? "").trim().replace(/\s+/g, "");
  const brand = (input.brand ?? "").trim();
  const spec = (input.spec ?? "").trim();

  let sanitizedAny = false;
  const variants = texts.map((raw) => {
    const s = sanitize(raw);
    if (s.changed) sanitizedAny = true;
    const h = normText(s.text);
    const factors: ExposureFactors = {
      ingredient: !!ingredient && h.includes(normText(ingredient)),
      bodyPart: !!bodyEffect && h.includes(normText(bodyEffect)),
      brand: !!brand && h.includes(normText(brand)),
      spec: !!spec && h.includes(normText(spec)),
      relatedCoverage: coverageOf(s.text, relatedTerms, ingredient),
    };
    return { text: s.text, exposure: scoreExposure(factors) };
  });
  return { variants, sanitized: sanitizedAny };
}

/** 규칙 안 + AI 안을 합쳐 중복을 걷어내고 상위 5개만 남긴다 (노출도 높은 순). */
export function mergeTitles(rule: TitleVariant[], ai: TitleVariant[]): TitleVariant[] {
  const rank: Record<string, number> = { 상: 0, 중: 1, 하: 2 };
  const seen = new Set<string>();
  return [...rule, ...ai]
    .filter((v) => {
      const k = normText(v.text);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => rank[a.exposure] - rank[b.exposure])
    .slice(0, 5);
}

/**
 * 태그 20개 재구성.
 * 규칙 태그 앞 15개(증상·원료·네이버 연관어)는 실측 기반이라 그대로 두고,
 * 뒤쪽 하드코딩 상수(대상군·계절) 자리를 AI 제안으로 채운다. 모자라면 규칙 태그로 되메운다.
 */
export function mergeTags(
  ruleTags: string[],
  aiTags: string[],
): { tags: string[]; sanitized: boolean } {
  let sanitizedAny = false;
  const clean = (list: string[]) =>
    list
      .map((t) => {
        const s = sanitize(t.trim().replace(/^#/, "").replace(/\s+/g, ""));
        if (s.changed) sanitizedAny = true;
        return s.text;
      })
      .filter(Boolean);

  const tags = dedupePad(
    [...clean(ruleTags.slice(0, 15)), ...clean(aiTags), ...clean(ruleTags.slice(15))],
    20,
  );
  return { tags, sanitized: sanitizedAny };
}
