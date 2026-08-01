import type { SubcategoryDetail } from "@/lib/taxonomy/types";
import { parseProductName, specLine, type ProductSpec } from "./parse-name";

/**
 * 후킹페이지 프롬프트에 넣을 상품 컨텍스트.
 *
 * 크롤한 `detail.text`가 비어 있어(3사 실측: 0자 / 탭 레이블 258자 / 0자) 쓸 수 있는
 * 원천이 **상품명 + 원료 매칭** 둘뿐이다. 여기서 그 둘을 후킹 문구가 필요로 하는 형태로
 * 조립한다.
 *
 * - 상품명 → 브랜드·제형·함량·수량 (parse-name)
 * - 원료 매칭 → 부위·증상 키워드 (taxonomy 역매핑)
 *
 * 크롤러를 고쳐 상품필수 정보를 확보하면 인증·섭취방법이 더해지지만, 여기서 뽑는 값은
 * 그때도 그대로 쓰인다.
 */
export interface ProductContext {
  name: string;
  spec: ProductSpec;
  /** "600mg · 60정 · 2개월분" — 값이 없으면 빈 문자열 */
  specText: string;
  /** 매칭된 원료 정식명 */
  ingredients: string[];
  /** 이 원료들이 걸린 중분류 이름 (예: "수면", "관절·연골") */
  bodyParts: string[];
  /** 이 원료들에 매핑된 증상 키워드 (예: "불면", "잠들기 어려움") */
  symptoms: string[];
}

/**
 * 원료 → 부위·증상 역매핑.
 *
 * taxonomy는 `부위 → 원료` 방향으로만 저장돼 있어서(중분류 안에 원료 목록), 원료로
 * 찾으려면 전체를 훑어야 한다. 중분류가 60여 개뿐이라 인덱스를 따로 만들 이유는 없다.
 *
 * 원료의 `symptoms`가 비어 있으면 "중분류 전체에 해당"이라는 뜻이라(taxonomy/types.ts)
 * 그 중분류의 증상 키워드를 통째로 가져온다.
 */
function reverseMap(
  ingredients: readonly string[],
  details: Record<string, SubcategoryDetail>,
  subcategoryNames: Record<string, string>,
  subcategorySymptoms: Record<string, string[]>,
): { bodyParts: string[]; symptoms: string[] } {
  const parts = new Set<string>();
  const symptoms = new Set<string>();

  for (const [slug, detail] of Object.entries(details)) {
    for (const rec of detail.ingredients) {
      if (!ingredients.includes(rec.name)) continue;
      const partName = subcategoryNames[slug];
      if (partName) parts.add(partName);
      const list = rec.symptoms.length ? rec.symptoms : (subcategorySymptoms[slug] ?? []);
      list.forEach((s) => symptoms.add(s));
    }
  }
  return { bodyParts: [...parts], symptoms: [...symptoms] };
}

export function buildProductContext(input: {
  name: string;
  ingredients: readonly string[];
  /** 원료 사전 전체 이름 — 브랜드/원료 구분에 쓴다 */
  allIngredientNames: readonly string[];
  details: Record<string, SubcategoryDetail>;
  subcategoryNames: Record<string, string>;
  subcategorySymptoms: Record<string, string[]>;
}): ProductContext {
  const spec = parseProductName(input.name, input.allIngredientNames);
  const { bodyParts, symptoms } = reverseMap(
    input.ingredients,
    input.details,
    input.subcategoryNames,
    input.subcategorySymptoms,
  );
  return {
    name: input.name,
    spec,
    specText: specLine(spec),
    ingredients: [...input.ingredients],
    bodyParts,
    // 증상이 너무 많으면 프롬프트가 흐려진다. 앞 6개면 후킹 각도를 잡기에 충분하다.
    symptoms: symptoms.slice(0, 6),
  };
}
