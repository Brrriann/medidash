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

/**
 * 텍스트에서 매칭된 원료 id 목록(중복 제거, 사전 순서 유지).
 * 원료명 + 모든 alias를 정규화해 부분 문자열 포함으로 판정한다.
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
    const baseName = ing.name.split(/[([{]/)[0];
    const needles = [...new Set(
      [ing.name, baseName, ...ing.aliases]
        .map(normalize)
        .filter((n) => n.length >= 2), // 1글자는 오탐 방지 위해 제외
    )];
    if (needles.some((n) => haystack.includes(n))) {
      matched.push(ing.id);
    }
  }
  return matched;
}

/** 여러 필드(상품명 + 상세)를 합쳐 매칭 */
export function matchFromFields(
  fields: (string | null | undefined)[],
  dict: IngredientDict[],
): number[] {
  return matchIngredients(fields.filter(Boolean).join(" \n "), dict);
}
