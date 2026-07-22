import type { CertificationType } from "@/lib/taxonomy/types";

/**
 * 원료 더미 시드 (docs/SPEC.md §9 Week 1 — "원료 더미").
 * ⚠️ 개발·시연용 샘플. 실데이터(고객 제공 원료/함량/매핑)는 scripts/seed-contents.ts로 교체 적재한다.
 * seed(scripts/seed.ts)와 mock 모드 렌더(src/lib/data)가 공용으로 사용.
 */
export interface SampleIngredient {
  name: string;
  aliases: string[];
  certificationType: CertificationType;
  dailyIntake: string;
  note: string;
  /** 매핑: 중분류 slug → 해당 중분류의 증상 키워드 목록 */
  mappings: Record<string, string[]>;
}

export const SAMPLE_INGREDIENTS: SampleIngredient[] = [
  {
    name: "루테인",
    aliases: ["lutein", "마리골드꽃추출물"],
    certificationType: "고시형",
    dailyIntake: "10~20mg",
    note: "[샘플] 노화로 감소할 수 있는 황반색소 밀도 유지",
    mappings: { eye: ["눈침침", "시력저하", "눈피로"] },
  },
  {
    name: "지아잔틴",
    aliases: ["zeaxanthin"],
    certificationType: "개별인정형",
    dailyIntake: "2~4mg",
    note: "[샘플] 루테인과 병용 구성 다수",
    mappings: { eye: ["눈침침", "야맹"] },
  },
  {
    name: "밀크씨슬 추출물",
    aliases: ["milk thistle", "실리마린", "카르두스 마리아누스"],
    certificationType: "고시형",
    dailyIntake: "실리마린 130mg",
    note: "[샘플] 간 건강 카테고리 대표 원료",
    mappings: { liver: ["숙취", "간수치", "지방간", "피로"] },
  },
  {
    name: "프로바이오틱스",
    aliases: ["probiotics", "유산균", "락토바실러스"],
    certificationType: "고시형",
    dailyIntake: "1억~100억 CFU",
    note: "[샘플] 장 카테고리 대표 원료",
    mappings: { gut: ["변비", "설사", "과민성장", "잔변감", "복부팽만"] },
  },
  {
    name: "오메가3 (EPA·DHA)",
    aliases: ["omega3", "EPA", "DHA", "피쉬오일"],
    certificationType: "고시형",
    dailyIntake: "EPA+DHA 합 500~2,000mg",
    note: "[샘플] 혈행·혈중지질 복수 카테고리 매핑 예시",
    mappings: {
      "blood-flow": ["손발저림", "손발차가움"],
      "blood-lipid": ["중성지방"],
    },
  },
  {
    name: "콘드로이친",
    aliases: ["chondroitin", "콘드로이친황산"],
    certificationType: "개별인정형",
    dailyIntake: "1,200mg",
    note: "[샘플] 관절 연골 카테고리",
    mappings: { joint: ["무릎통증", "관절연골"] },
  },
  {
    name: "MSM (디메틸설폰)",
    aliases: ["msm", "식이유황"],
    certificationType: "고시형",
    dailyIntake: "1,500~2,000mg",
    note: "[샘플] 관절·연골 카테고리",
    mappings: { joint: ["무릎통증", "손목통증"] },
  },
  {
    name: "쏘팔메토 열매 추출물",
    aliases: ["saw palmetto", "소팔메토"],
    certificationType: "고시형",
    dailyIntake: "로르산 기준 320mg",
    note: "[샘플] 전립선 카테고리 대표 원료",
    mappings: { prostate: ["전립선비대", "빈뇨", "잔뇨"] },
  },
  {
    name: "홍삼",
    aliases: ["red ginseng", "홍삼농축액"],
    certificationType: "고시형",
    dailyIntake: "진세노사이드 Rg1+Rb1+Rg3 합 3~80mg",
    note: "[샘플] 면역 카테고리 대표 원료",
    mappings: { immunity: ["잦은감기", "환절기", "면역저하"] },
  },
  {
    name: "테아닌",
    aliases: ["L-theanine", "엘테아닌"],
    certificationType: "개별인정형",
    dailyIntake: "200~250mg",
    note: "[샘플] 스트레스·수면 복수 매핑 예시",
    mappings: { stress: ["스트레스", "긴장"], sleep: ["불면"] },
  },
  {
    name: "감태 추출물",
    aliases: ["ecklonia cava"],
    certificationType: "개별인정형",
    dailyIntake: "500mg",
    note: "[샘플] 수면 카테고리",
    mappings: { sleep: ["얕은잠", "잠들기 어려움"] },
  },
  {
    name: "은행잎 추출물",
    aliases: ["ginkgo", "징코"],
    certificationType: "고시형",
    dailyIntake: "플라보놀배당체 28~36mg",
    note: "[샘플] 기억력 카테고리",
    mappings: { memory: ["건망증", "집중력 저하"] },
  },
  {
    name: "바나바잎 추출물",
    aliases: ["banaba", "코로솔산"],
    certificationType: "고시형",
    dailyIntake: "코로솔산 0.45~1.3mg",
    note: "[샘플] 혈당 카테고리",
    mappings: { "blood-sugar": ["식후혈당", "당뇨전단계"] },
  },
  {
    name: "가르시니아캄보지아 추출물",
    aliases: ["garcinia", "HCA"],
    certificationType: "고시형",
    dailyIntake: "총 HCA 750~2,800mg",
    note: "[샘플] 체지방 카테고리",
    mappings: { "body-fat": ["뱃살", "다이어트", "내장지방"] },
  },
  {
    name: "백수오 등 복합추출물",
    aliases: ["백수오"],
    certificationType: "개별인정형",
    dailyIntake: "514mg",
    note: "[샘플] 여성갱년기 카테고리",
    mappings: { "female-menopause": ["갱년기", "안면홍조"] },
  },
  {
    name: "히알루론산",
    aliases: ["hyaluronic acid", "히알루론산나트륨"],
    certificationType: "고시형",
    dailyIntake: "120~240mg",
    note: "[샘플] 피부 보습 카테고리",
    mappings: { skin: ["건조", "탄력"] },
  },
  {
    name: "코엔자임Q10",
    aliases: ["coq10", "유비퀴논"],
    certificationType: "고시형",
    dailyIntake: "90~100mg",
    note: "[샘플] 혈압·항산화 복수 매핑 예시",
    mappings: { "blood-pressure": ["고혈압"], antioxidant: ["활성산소"] },
  },
  {
    name: "비오틴",
    aliases: ["biotin", "비타민B7"],
    certificationType: "고시형",
    dailyIntake: "0.9mg",
    note: "[샘플] 모발·손톱 카테고리",
    mappings: { "hair-loss": ["모발가늘어짐"], nails: ["손톱약함", "손톱갈라짐"] },
  },
  {
    name: "크랜베리 추출물",
    aliases: ["cranberry", "프로안토시아니딘"],
    certificationType: "개별인정형",
    dailyIntake: "프로안토시아니딘 36mg",
    note: "[샘플] 방광(요로) 카테고리",
    mappings: { bladder: ["방광염"] },
  },
  {
    name: "아연",
    aliases: ["zinc"],
    certificationType: "고시형",
    dailyIntake: "8.5mg (영양성분 기준)",
    note: "[샘플] 남성건강 카테고리",
    mappings: { men: ["정자", "활력"] },
  },
];
