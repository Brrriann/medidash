import type { BodyCategory } from "./types";

/**
 * 대·중·소 3단 분류 확정안 — docs/UI-PLAN.md §3 전체 분류표 원본.
 * 10계통 × 중분류 32종 × 증상 키워드. DB 시드(scripts/seed.ts)와
 * mock 모드 렌더의 단일 원천(single source of truth).
 * 분류 추가는 이 데이터(→ DB 행)만 늘리면 UI가 그대로 따라온다.
 */
export const TAXONOMY: BodyCategory[] = [
  {
    slug: "nervous",
    name: "신경계/뇌",
    svgRegion: "head",
    sort: 1,
    subcategories: [
      { slug: "memory", name: "기억력·인지", sort: 1, symptoms: ["집중력 저하", "건망증", "학습능력", "뇌피로"] },
      { slug: "stress", name: "스트레스·긴장", sort: 2, symptoms: ["스트레스", "긴장", "불안", "신경예민"] },
      { slug: "sleep", name: "수면", sort: 3, symptoms: ["불면", "얕은잠", "잠들기 어려움", "낮졸림"] },
    ],
  },
  {
    slug: "sensory",
    name: "감각계",
    svgRegion: "face",
    sort: 2,
    subcategories: [
      { slug: "eye", name: "눈 건강", sort: 1, symptoms: ["눈침침", "안구건조", "시력저하", "눈피로", "야맹"] },
      { slug: "ear", name: "귀·청력", sort: 2, symptoms: ["이명", "청력저하", "어지럼"] },
      { slug: "oral", name: "구강", sort: 3, symptoms: ["잇몸건강", "구취", "치아"] },
    ],
  },
  {
    slug: "circulatory",
    name: "순환계",
    svgRegion: "heart",
    sort: 3,
    subcategories: [
      { slug: "blood-flow", name: "혈행", sort: 1, symptoms: ["손발저림", "손발차가움", "어지럼"] },
      { slug: "blood-pressure", name: "혈압", sort: 2, symptoms: ["고혈압", "저혈압", "두통"] },
      { slug: "blood-lipid", name: "혈중지질", sort: 3, symptoms: ["콜레스테롤", "중성지방", "동맥경화"] },
      { slug: "heart", name: "심장", sort: 4, symptoms: ["두근거림", "부정맥", "심장피로"] },
    ],
  },
  {
    slug: "digestive",
    name: "소화·대사계",
    svgRegion: "abdomen",
    sort: 4,
    subcategories: [
      { slug: "liver", name: "간", sort: 1, symptoms: ["숙취", "피로", "간수치", "지방간"] },
      { slug: "stomach", name: "위", sort: 2, symptoms: ["속쓰림", "소화불량", "위산역류", "트림"] },
      { slug: "gut", name: "장", sort: 3, symptoms: ["변비", "설사", "과민성장", "잔변감", "복부팽만", "가스", "방귀증가"] },
      { slug: "body-fat", name: "체지방", sort: 4, symptoms: ["뱃살", "내장지방", "셀룰라이트", "다이어트"] },
      { slug: "blood-sugar", name: "혈당", sort: 5, symptoms: ["당뇨전단계", "식후혈당", "인슐린"] },
    ],
  },
  {
    slug: "musculoskeletal",
    name: "근골격계",
    svgRegion: "joints",
    sort: 5,
    subcategories: [
      { slug: "joint", name: "관절", sort: 1, symptoms: ["무릎통증", "관절연골", "오십견", "손목통증"] },
      { slug: "bone", name: "뼈", sort: 2, symptoms: ["골다공증", "골밀도", "성장"] },
      { slug: "muscle", name: "근육", sort: 3, symptoms: ["근감소", "근력저하", "운동회복"] },
    ],
  },
  {
    slug: "immune",
    name: "면역·방어계",
    svgRegion: "chip",
    sort: 6,
    subcategories: [
      { slug: "immunity", name: "면역력", sort: 1, symptoms: ["잦은감기", "환절기", "면역저하"] },
      { slug: "antioxidant", name: "항산화", sort: 2, symptoms: ["노화", "활성산소", "세포손상"] },
      { slug: "skin", name: "피부", sort: 3, symptoms: ["아토피", "건조", "여드름", "잡티", "탄력"] },
    ],
  },
  {
    slug: "endocrine",
    name: "내분비계",
    svgRegion: "chip",
    sort: 7,
    subcategories: [
      { slug: "female-menopause", name: "여성갱년기", sort: 1, symptoms: ["갱년기", "안면홍조", "야간발한"] },
      { slug: "male-menopause", name: "남성갱년기", sort: 2, symptoms: ["남성갱년기", "활력저하"] },
      { slug: "thyroid", name: "갑상선·부신", sort: 3, symptoms: ["만성피로", "대사저하"] },
    ],
  },
  {
    slug: "urogenital",
    name: "생식·비뇨계",
    svgRegion: "pelvis",
    sort: 8,
    subcategories: [
      { slug: "men", name: "남성건강", sort: 1, symptoms: ["정력", "활력", "정자"] },
      { slug: "women", name: "여성건강", sort: 2, symptoms: ["월경통", "월경불순", "PMS"] },
      { slug: "prostate", name: "전립선", sort: 3, symptoms: ["전립선비대", "빈뇨", "잔뇨"] },
      { slug: "bladder", name: "방광", sort: 4, symptoms: ["요실금", "방광염"] },
    ],
  },
  {
    slug: "respiratory",
    name: "호흡기계",
    svgRegion: "lungs",
    sort: 9,
    subcategories: [
      { slug: "lung", name: "폐·기관지", sort: 1, symptoms: ["미세먼지", "기침", "가래"] },
      { slug: "throat", name: "목·인후", sort: 2, symptoms: ["인후통", "목건조"] },
    ],
  },
  {
    slug: "hair-nails",
    name: "모발·손발톱",
    svgRegion: "hair",
    sort: 10,
    subcategories: [
      { slug: "hair-loss", name: "탈모", sort: 1, symptoms: ["탈모", "모발가늘어짐", "흰머리"] },
      { slug: "nails", name: "손톱·발톱", sort: 2, symptoms: ["손톱갈라짐", "손톱약함"] },
    ],
  },
];

export function findCategory(slug: string) {
  return TAXONOMY.find((c) => c.slug === slug) ?? null;
}

export function findSubcategory(slug: string) {
  for (const cat of TAXONOMY) {
    const sub = cat.subcategories.find((s) => s.slug === slug);
    if (sub) return { category: cat, subcategory: sub };
  }
  return null;
}
