import type { CertificationType } from "@/lib/taxonomy/types";

/**
 * 원료 사전 시드 (docs/SPEC.md §9 Week 1).
 * seed(scripts/seed.ts) → `medidash.ingredients` 테이블 적재.
 * 크롤러·import·rematch가 이 테이블을 사전으로 읽어 `wholesale_products.ingredient_ids`를 채우고,
 * mock 모드 렌더(src/lib/data)와 태그 생성(src/lib/titles)도 같은 데이터를 쓴다.
 *
 * 두 부류가 섞여 있다:
 *  1) **상세형(1~20)** — 증상 매핑·인정형·섭취량까지 있는 인체지도 상세 패널용. 값은 아직 [샘플].
 *  2) **매칭형(21~)** — 도매몰 상품명 실측(미매칭 4,186건 토큰 빈도)에서 뽑은 원료.
 *     검색·태그·방송배지가 목적이라 name+aliases만 채우고 공전 정보는 null로 둔다.
 * 고객이 실제 원료/함량/매핑을 주면 scripts/seed-contents.ts로 교체 적재한다.
 */
export interface SampleIngredient {
  name: string;
  aliases: string[];
  /**
   * 식약처 공전 정보. **미확인 원료는 null** — 지어내지 않는다.
   * 인정형·섭취량 오표기는 광고 심의 리스크다(docs/UI-PLAN.md §9).
   * null이면 상세 패널에서 배지·섭취량 줄이 그냥 빠진다(DetailPanel이 가드).
   */
  certificationType: CertificationType | null;
  dailyIntake: string | null;
  note: string;
  /** 매핑: 중분류 slug → 해당 중분류의 증상 키워드 목록. 매칭 전용 원료는 빈 객체. */
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
    aliases: ["msm", "식이유황", "엠에스엠"],
    certificationType: "고시형",
    dailyIntake: "1,500~2,000mg",
    note: "[샘플] 관절·연골 카테고리",
    mappings: { joint: ["무릎통증", "손목통증"] },
  },
  {
    name: "쏘팔메토 열매 추출물",
    aliases: ["saw palmetto", "소팔메토", "쏘팔"],
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
    aliases: ["garcinia", "HCA", "가르시니아"],
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
    aliases: ["coq10", "유비퀴논", "코큐텐", "코엔자임큐텐"],
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

  // ──────────────────────────────────────────────────────────────────
  // 매칭형 — 도매몰 상품명 실측에서 뽑은 원료. 공전 정보는 미확인이라 null.
  // 증상 매핑도 비워 둔다(인체지도 추천에는 안 뜨고, 검색·태그·배지에만 쓰임).
  // ──────────────────────────────────────────────────────────────────
  match("비타민C", ["vitamin c", "아스코르브산", "ascorbic acid", "비타민씨"]),
  match("비타민D", ["vitamin d", "콜레칼시페롤", "비타민디"]),
  match("비타민B군", ["비타민b", "vitamin b", "비타민비"]),
  match("비타민E", ["vitamin e", "토코페롤", "tocopherol"]),
  match("비타민A", ["vitamin a", "레티놀", "베타카로틴"]),
  match("멀티비타민", ["multivitamin", "종합비타민"]),
  match("엽산", ["folic acid", "folate"]),
  match("미네랄", ["mineral", "멀티미네랄"]),
  match("마그네슘", ["magnesium", "산화마그네슘", "글루콘산마그네슘"]),
  match("칼슘", ["calcium", "해조칼슘"]),
  match("철분", ["헴철", "ferrous"]),
  match("셀레늄", ["selenium", "셀렌"]),
  match("콜라겐", ["collagen", "저분자콜라겐", "피쉬콜라겐"]),
  match("프로폴리스", ["propolis"]),
  match("글루타치온", ["glutathione", "글루타티온"]),
  match("차전자피", ["psyllium", "질경이씨앗껍질"]),
  match("아르기닌", ["arginine", "엘아르기닌"]),
  match("흑염소", ["흑염소진액"]),
  match("옥타코사놀", ["octacosanol", "옥타"]),
  match("폴리코사놀", ["policosanol"]),
  match("글루코사민", ["glucosamine"]),
  match("식이섬유", ["dietary fiber", "난소화성말토덱스트린"]),
  match("NMN", ["니코틴아미드모노뉴클레오타이드"]),
  match("프리바이오틱스", ["prebiotics", "프락토올리고당", "이눌린"]),
  match("멜라토닌", ["melatonin"]),
  match("포스파티딜세린", ["phosphatidylserine"]),
  match("스페르미딘", ["spermidine"]),
  match("난각막", ["eggshell membrane"]),
  match("알부민", ["albumin", "난백알부민"]),
  match("타우린", ["taurine"]),
  match("카르니틴", ["carnitine", "엘카르니틴"]),
  match("이노시톨", ["inositol"]),
  match("스피루리나", ["spirulina"]),
  match("클로렐라", ["chlorella"]),
  match("초유", ["colostrum"]),
  match("맥주효모", ["brewer yeast", "효모"]),
  match("보스웰리아", ["boswellia"]),
  match("커큐민", ["curcumin", "강황", "울금"]),
  match("녹차 추출물", ["green tea", "카테킨"]),
  match("헛개나무 추출물", ["헛개", "hovenia"]),
  match("빌베리 추출물", ["bilberry", "안토시아닌"]),
  match("블루베리", ["blueberry"]),
  match("아사이베리", ["acai"]),
  match("석류 추출물", ["pomegranate"]),
  match("노니", ["noni", "모린다시트리폴리아"]),
  match("마카", ["maca"]),
  match("홍경천 추출물", ["rhodiola"]),
  match("크릴오일", ["krill"]),
  match("나토키나제", ["nattokinase"]),
  match("포스콜린", ["forskolin", "콜레우스포스콜리"]),
  match("실크아미노산", ["세리신"]),
  match("유산균사균체", ["사균체", "포스트바이오틱스"]),
  // 2차 라운드 — 1차 재매칭 후 남은 미매칭 2,125건에서 다시 추출
  match("비타민K2", ["메나퀴논", "mk7", "mk-7", "vitamin k"]),
  match("감마리놀렌산", ["gla", "보라지오일", "달맞이꽃종자유"]),
  match("모링가", ["moringa", "모링가잎"]),
  match("산양유", ["산양유단백", "goat milk"]),
  match("레시틴", ["lecithin"]),
  match("라이코펜", ["lycopene", "리코펜"]),
  match("유단백추출물", ["mbp", "유단백"]),
  match("애사비", ["사과초모식초", "사과식초"]),
  match("카무트", ["kamut", "호라산밀"]),
  match("컬리케일", ["케일", "kale"]),
  match("맥문동", []),
  match("양배추", ["cabbage"]),
  match("삼백초", []),
  match("푸룬", ["프룬", "prune"]),
  match("대마종자유", ["햄프씨드", "hemp seed"]),
];

/** 매칭형 원료 1건. 공전 정보·증상 매핑이 없는 케이스를 한 줄로 적기 위한 헬퍼. */
function match(name: string, aliases: string[]): SampleIngredient {
  return {
      name,
      aliases,
      certificationType: null,
      dailyIntake: null,
      note: "도매몰 상품명 매칭용 — 식약처 공전 정보 미확인",
      mappings: {},
  };
}
