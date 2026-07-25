/**
 * 원료 매칭 (docs/SPEC.md §6.2) — 순수 함수, 단위 테스트 대상.
 * 상품명·상세 텍스트에서 `ingredients.aliases` 사전으로 원료를 찾아 id 목록을 만든다.
 * 크롤러가 채우는 `wholesale_products.ingredient_ids`의 원천.
 */
import type { IngredientDict } from "./types";

/** 한글/영문 혼용·공백·대소문자 차이를 흡수하기 위한 정규화 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\-_·,()[\]/]+/g, "") // 공백·구분자 제거
    .trim();
}

/** 형태 접미사 — "밀크씨슬 추출물" → "밀크씨슬" */
const FORM_SUFFIX = /(등\s*복합)?\s*(추출물|농축액|농축분말|분말|발효물|건조물)\s*$/;
/** 부위 접미사 — "쏘팔메토 열매" → "쏘팔메토" */
const PART_SUFFIX = /\s*(열매|잎|뿌리|씨앗|씨|꽃|껍질)\s*$/;

/**
 * 정식명에서 핵심어 후보를 만든다.
 * 도매몰 상품명은 정식명을 안 쓰고 핵심어만 적는 게 대부분이라(예: "쏘팔메토 1000mg"),
 * 이 파생이 없으면 사전에 등록된 원료조차 놓친다.
 * 과매칭 방지: 형태 접미사만 뗀 결과는 2자 이상, 부위까지 뗀 결과는 3자 이상만 채택
 * (예: "은행잎 추출물" → "은행"(2자)은 버려 일반어 오탐을 막는다).
 */
function deriveCoreTerms(name: string): string[] {
  const out: string[] = [];
  const noForm = name.replace(FORM_SUFFIX, "").trim();
  if (noForm !== name && noForm.length >= 2) out.push(noForm);
  const noPart = noForm.replace(PART_SUFFIX, "").trim();
  if (noPart !== noForm && noPart.length >= 3) out.push(noPart);
  return out;
}

/**
 * 텍스트에서 매칭된 원료 id 목록(중복 제거, 사전 순서 유지).
 * 원료명 + 파생 핵심어 + 모든 alias를 정규화해 부분 문자열 포함으로 판정한다.
 */
export function matchIngredients(
  text: string,
  dict: IngredientDict[],
): number[] {
  const haystack = normalize(text);
  if (!haystack) return [];

  const matched: number[] = [];
  for (const ing of dict) {
    // 원료명 + 괄호/대괄호 앞 기본명(예: "오메가3 (EPA·DHA)" → "오메가3") + 별칭
    const baseName = ing.name.split(/[([{]/)[0].trim();
    const needles = [...new Set(
      [
        ing.name,
        baseName,
        ...deriveCoreTerms(ing.name),
        ...deriveCoreTerms(baseName),
        ...ing.aliases,
      ]
        .map(normalize)
        .filter((n) => n.length >= 2), // 1글자는 오탐 방지 위해 제외
    )];
    if (needles.some((n) => haystack.includes(n))) {
      matched.push(ing.id);
    }
  }
  return matched;
}

/**
 * 여러 필드를 합쳐 매칭.
 *
 * ⚠️ **상세 텍스트는 넣지 말 것.** 3사 도매몰의 상세는 성분표가 아니라 판매정책 안내문이다.
 * 6,003건 실측: 상세를 넣으면 매칭이 64.6%→64.8%(+10건)로 거의 안 늘면서, 상세로만 붙은
 * 42건 중 29건이 오탐이었다 — "블루베리(삼성복지몰)" 같은 **판매금지 채널 목록**을 원료로 잡는다.
 * 그래서 크롤·import·rematch 모두 상품명만 넘긴다. 상세에 진짜 성분표가 들어오는 몰이
 * 생기면 그때 그 몰만 예외로 두면 된다.
 */
export function matchFromFields(
  fields: (string | null | undefined)[],
  dict: IngredientDict[],
): number[] {
  return matchIngredients(fields.filter(Boolean).join(" \n "), dict);
}
