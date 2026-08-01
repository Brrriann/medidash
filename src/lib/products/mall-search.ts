/**
 * 타몰 시세 확인용 검색 링크.
 *
 * **왜 실판매가를 긁어 오지 않는가**: docs/SPEC.md §2가 도매몰·홈쇼핑모아 실시간 연동을
 * 막고 있고, 오픈마켓 시세는 하루에도 몇 번씩 바뀌어 월 1회 배치로 담으면 오히려
 * 틀린 값을 보여 주게 된다. 그래서 값을 우리가 들고 있지 않고 **셀러를 그 몰의 검색
 * 결과로 보낸다.** 데이터 0, 갱신 부담 0, 항상 최신이다.
 *
 * 순서는 쿠팡·네이버쇼핑을 앞에 둔다 — 이 서비스가 겨냥하는 판매 채널이라
 * 셀러가 가장 먼저 볼 값이다.
 *
 * URL 형식은 봇 차단(403·418) 때문에 결과 페이지 렌더까지는 확인하지 못했다.
 * 경로가 바뀌면 이 파일 한 줄만 고치면 된다.
 */

export interface MallLink {
  key: string;
  label: string;
  url: (keyword: string) => string;
}

export const MALL_LINKS: MallLink[] = [
  {
    key: "coupang",
    label: "쿠팡",
    url: (k) => `https://www.coupang.com/np/search?q=${encodeURIComponent(k)}`,
  },
  {
    key: "naver",
    label: "네이버",
    url: (k) =>
      `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(k)}`,
  },
  {
    key: "11st",
    label: "11번가",
    url: (k) => `https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(k)}`,
  },
  {
    key: "gmarket",
    label: "G마켓",
    url: (k) => `https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(k)}`,
  },
];

/**
 * 상품명에서 검색어를 뽑는다.
 *
 * 도매몰 상품명을 통째로 넣으면("웰러스 100억 생유산균 프로바이오틱스 450mg x 60캡슐")
 * 그 몰에는 같은 상품이 없어 결과가 0건이 된다. 브랜드를 떼고 **원료 + 규격**만 남겨야
 * 같은 성격의 상품이 걸린다. 원료를 못 뽑았으면 상품명 앞 두 마디로 폴백한다.
 */
export function mallSearchKeyword(name: string, ingredients: string[]): string {
  if (ingredients.length > 0) return ingredients.slice(0, 2).join(" ");
  return name.split(/\s+/).slice(0, 2).join(" ");
}
