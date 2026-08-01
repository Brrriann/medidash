/**
 * 도매몰 상품명 파서.
 *
 * **왜 상품명을 파싱하는가**
 * 크롤한 `detail.text`에 상품 정보가 없다. 3사 실측 결과 gonyb2b·upickb2b는 빈 문자열이고,
 * ggsan은 258자가 전부 "상품상세정보 / 배송안내 / 교환 및 반품안내" 같은 탭 레이블이다.
 * 반면 **상품명에는 브랜드·원료·제형·함량·수량이 규격화된 형태로 들어 있다.**
 *
 *   "라이프플러스 삼백초 맥문동 정 600mg x 60정"
 *    └─브랜드──┘ └──원료───┘ └제형┘└함량─┘  └수량┘
 *
 * 그래서 재크롤 없이 상품명만으로 후킹 문구에 쓸 규격을 뽑는다. 크롤러를 고쳐 상품필수
 * 정보를 확보하면 인증·섭취방법이 더해지지만, 여기서 뽑는 값은 그때도 그대로 쓰인다.
 *
 * 정규식은 실제 상품명 60건을 놓고 맞췄다. 표기가 제각각이라 아래 변형을 모두 받는다:
 *   "450mg x 60캡슐" · "450mg x90캡슐"(공백 없음) · "1,100mg x 60정"(천단위 쉼표)
 *   "2g x 20포" · "211mg x 20매x 3개"(세트) · "1000mg x 60정 x 2개입"
 *   "[소비기한임박할인] …" · "(10개월) …" · "… (멜라토닌 함유)"
 */

/** 제형 — 규격 표기의 단위에서 뽑는다 */
export type Form = "정" | "캡슐" | "포" | "매";

export interface ProductSpec {
  /** 첫 어절이 원료명이 아니면 브랜드로 본다. 브랜드 없는 상품명도 흔해서 null 가능 */
  brand: string | null;
  form: Form | null;
  /** 1정(1캡슐·1포)당 함량. g·mg 표기를 mg로 통일한다 */
  mgPerUnit: number | null;
  /** 통 하나에 든 개수 */
  unitCount: number | null;
  /** 세트 구성 개수. "x 3개" / "x 2개입" 표기, 없으면 1 */
  packCount: number;
  /** 상품명에 "(10개월)"처럼 명시된 경우만. 1일 섭취량을 모르므로 추정하지 않는다 */
  monthsSupply: number | null;
  /** 판매 태그·규격을 걷어낸 핵심 상품명 — 후킹 문구의 주어로 쓴다 */
  core: string;
  /** "[소비기한임박할인]", "(쿠팡 등록 불가)" 같은 판매 태그. 후킹 문구에 넣으면 안 된다 */
  tags: string[];
}

/** 앞뒤에 붙는 대괄호·괄호 태그 */
const TAG = /(\[[^\]]*\]|\([^)]*\))/g;

/**
 * 규격: 함량 + 단위 + 구분자 + 수량 + 제형.
 * 6,003건 실측에서 나온 변형을 모두 받는다 — `x` 앞뒤 공백 없음, 구분자가 `*`인 표기
 * (`700mg*60캡슐`), 천단위 쉼표, 단위 앞 공백(`1,000 mg`).
 */
const SPEC = /(\d[\d,]*(?:\.\d+)?)\s*(mg|g|kg|ml|IU)\s*[x×X*]\s*(\d[\d,]*)\s*(정|캡슐|포|매)/i;

/**
 * 함량 없이 수량만 적힌 표기 — `(30캡슐)`, `(60정)`, `(50포)`.
 * 실측에서 이 형태가 꽤 많아 SPEC이 실패했을 때만 보조로 쓴다.
 * 앞에 숫자+단위가 붙은 경우는 SPEC이 이미 잡았으므로 여기 오지 않는다.
 */
const COUNT_ONLY = /(?:^|[(\s])(\d{1,4})\s*(정|캡슐|포|매)(?=[)\s]|$)/;

/** 세트 구성: "x 3개", "x 2개입" */
const PACK = /[x×X]\s*(\d+)\s*개입?/;

const num = (s: string) => Number(s.replace(/,/g, ""));

/**
 * 문장형 상품명 판별 — "지방 탄수화물 단백질대사는 …", "혈당엔 코로솔산 …",
 * "밀크씨슬은 간에 좋은 …" 처럼 효능을 문장으로 쓴 상품명이 도매몰에 흔하다.
 * 이런 이름의 첫 어절은 브랜드가 아니라 주어·부사어라서 그대로 쓰면
 * 후킹 문구에 "지방" 같은 단어가 브랜드로 박힌다.
 *
 * 판별은 조사로 끝나는 어절의 유무로 한다. **`이`·`가`는 넣지 않는다** —
 * "루아데이"처럼 `이`로 끝나는 실제 브랜드를 죽인다.
 */
function isSentenceStyle(core: string): boolean {
  return core
    .split(/\s+/)
    .some((w) => w.length >= 2 && /(은|는|엔|과|와|도)$/.test(w));
}

/** g·ml는 1000배로 환산해 mg로 통일한다. IU는 환산식이 원료마다 달라 버린다. */
function toMg(value: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u === "mg") return value;
  if (u === "g" || u === "ml") return value * 1000;
  if (u === "kg") return value * 1_000_000;
  return null;
}

export function parseProductName(
  raw: string,
  /** 원료 사전 이름들 — 첫 어절이 여기 있으면 브랜드가 아니라 원료로 본다 */
  ingredientNames: readonly string[] = [],
): ProductSpec {
  const name = raw.trim();

  const tags = (name.match(TAG) ?? []).map((t) => t.trim());
  const monthTag = tags.map((t) => t.match(/(\d+)\s*개월/)).find(Boolean);

  const specM = name.match(SPEC);
  // 함량이 없어 SPEC이 실패한 상품명에서 수량·제형만이라도 건진다.
  const countM = specM ? null : name.match(COUNT_ONLY);
  const packM = name.match(PACK);

  // core: 태그와 규격을 걷어낸 나머지. 후킹 문구에 판매 태그가 섞이면 안 된다.
  let core = name.replace(TAG, " ");
  if (specM) core = core.replace(specM[0], " ");
  core = core.replace(/[x×X]\s*\d+\s*개입?/g, " ").replace(/\s+/g, " ").trim();

  // 브랜드: 첫 어절. 단, 원료명이거나 문장형 상품명이면 브랜드가 아니다.
  const first = core.split(/\s+/)[0] ?? "";
  const looksIngredient = ingredientNames.some(
    (n) => first.includes(n) || n.includes(first),
  );
  // 숫자·기호로 시작하는 어절은 브랜드가 아니다 ("3분 김치…", "12종 비타민…", "100% 국산…")
  const brand =
    first &&
    !looksIngredient &&
    first.length <= 8 &&
    /^[가-힣A-Za-z]/.test(first) &&
    !isSentenceStyle(core)
      ? first
      : null;

  return {
    brand,
    form: specM ? (specM[4] as Form) : countM ? (countM[2] as Form) : null,
    mgPerUnit: specM ? toMg(num(specM[1]), specM[2]) : null,
    unitCount: specM ? num(specM[3]) : countM ? num(countM[1]) : null,
    packCount: packM ? Number(packM[1]) : 1,
    monthsSupply: monthTag ? Number(monthTag[1]) : null,
    core,
    tags,
  };
}

/** 후킹 문구에 그대로 넣을 수 있는 규격 한 줄. 값이 없으면 빈 문자열 */
export function specLine(s: ProductSpec): string {
  const parts: string[] = [];
  if (s.mgPerUnit) parts.push(`${s.mgPerUnit.toLocaleString("ko-KR")}mg`);
  if (s.unitCount && s.form) parts.push(`${s.unitCount}${s.form}`);
  if (s.packCount > 1) parts.push(`${s.packCount}개 세트`);
  if (s.monthsSupply) parts.push(`${s.monthsSupply}개월분`);
  return parts.join(" · ");
}
