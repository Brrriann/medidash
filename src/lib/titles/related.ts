/**
 * 네이버 상위 노출 상품명에서 뽑은 연관 키워드를, 셀러가 **실제로 따라 써도 되는 어휘**만
 * 남기도록 거른다.
 *
 * 왜 거르나:
 *  1. **타사 브랜드명**(종근당·안국건강·토비콤…)이 섞인다. 이걸 상품명·태그로 추천하면
 *     상표권 문제이고 플랫폼 어뷰징이다. 절대 추천 대상에 넣으면 안 된다.
 *  2. **제형·수량·수식어**(캡슐·정·개월분·프리미엄·골드…)는 변별력이 없다. 커버리지 분모에
 *     넣으면 "캡슐"만 적어도 점수가 오르는 이상한 지표가 된다.
 *
 * 커버리지 분모와 태그 추천 둘 다 이 필터를 통과한 어휘만 쓴다. 화면에는 원본 전체를
 * "상위 노출 상품이 쓰는 단어"로 보여주되, 브랜드는 쓰지 말라고 경고한다(정보 제공은 무방).
 */
import { BRAND_LEXICON } from "./brand-lexicon";

/** 제형·포장·수량·일반 수식어 — 상품명에 흔하지만 검색 변별력이 없다. */
const NOISE_WORDS = new Set([
  // 제형·포장
  "캡슐", "정제", "타블렛", "분말", "가루", "액상", "구미", "젤리", "스틱", "티백", "환",
  "파우치", "박스", "세트", "병", "팩", "포", "매", "알", "스푼", "필름", "발포", "츄어블",
  // 수량·기간
  "개월분", "개입", "일분", "회분", "인분",
  // 일반 수식어
  "프리미엄", "골드", "맥스", "파워", "플러스", "프라임", "오리진", "리얼", "퓨어", "슈퍼",
  "울트라", "하이", "미니", "라이트", "데일리", "원데이", "올인원", "컴플렉스", "밸런스",
  "고함량", "국내산", "수입", "직수입", "정품", "무료배송", "할인", "특가", "사은품",
  "건강기능식품", "영양제", "건강식품", "식품", "제품", "상품", "브랜드",
  // 네이버 응답에 &amp; 같은 HTML 엔티티가 그대로 남아 토큰으로 잡히는 경우가 있다
  "amp", "lt", "gt", "quot", "nbsp",
  // 조사가 붙어 잘린 조각·평가어 — 상품명에 넣어봐야 검색에 안 걸린다
  "좋은", "좋은데", "건강한", "최고", "인기", "추천", "베스트", "신제품", "증정", "사은품",
  "그대로", "담은", "바른", "순수", "진한", "가득", "하루", "매일", "함유", "전용", "판매",
]);

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_·,()[\]/]+/g, "");

/**
 * 추천·채점에 쓸 수 있는 연관 어휘만 남긴다.
 * 제외: 검색어 자신 · 타사 브랜드 · 제형/수식어 · 1글자 · 순수 숫자.
 */
export function usableRelated(
  related: { term: string; count: number }[],
  searchTerm: string,
): { term: string; count: number }[] {
  const self = norm(searchTerm);
  const seen = new Set<string>();
  const kept = related.filter((r) => {
    const t = r.term.trim();
    const n = norm(t);
    if (n.length < 2) return false;
    if (n === self) return false;
    if (/^\d+$/.test(n)) return false;
    if (NOISE_WORDS.has(t)) return false;
    if (isBrand(t)) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  // 조각 제거는 살아남은 어휘끼리 비교해야 판정이 되므로 2패스로 돈다
  const terms = new Set(kept.map((r) => r.term.trim()));
  return kept.filter((r) => !isFragment(r.term, terms));
}

/**
 * 브랜드 판정 — 사전 완전일치 + 한국 건기식 브랜드의 흔한 작명 패턴.
 * 사전 나열만으론 새 브랜드를 계속 놓치므로(닥터슈퍼칸·○○제약 …) 패턴을 함께 본다.
 * 원료명이 이 패턴에 걸리는 경우는 없다(추출물·비타민류는 접미사가 다르다).
 */
const BRAND_SUFFIX = /(제약|헬스케어|생활건강|메디컬|랩스|파마|웰니스|뉴트리션|엔에스)$/;
const BRAND_PREFIX = /^(닥터|dr)/i;

export function isBrand(term: string): boolean {
  const n = norm(term);
  if (BRAND_LEXICON.has(n)) return true;
  const t = term.trim();
  return BRAND_SUFFIX.test(t) || BRAND_PREFIX.test(t);
}

/**
 * 조사가 붙어 잘린 조각 걸러내기.
 * 네이버 상품명 "간에좋은 밀크씨슬"을 토큰화하면 "간에"·"간에좋은"이 나오는데,
 * 이런 건 상품명에 넣어봐야 검색에 안 걸린다. 조사로 끝나면 버린다.
 */
const PARTICLE_TAIL = /(에|에게|으로|로|은|는|이|가|을|를|의|와|과|도|만)$/;
function isFragment(term: string, keptTerms: Set<string>): boolean {
  const t = term.trim();
  if (!/[가-힣]$/.test(t)) return false;
  // "간에" → 조사 제거하면 "간", 이미 다른 어휘가 그 뿌리를 담고 있으면 조각
  const stem = t.replace(PARTICLE_TAIL, "");
  if (stem.length < 1 || stem === t) return false;
  return [...keptTerms].some((k) => k !== t && k.startsWith(stem));
}
