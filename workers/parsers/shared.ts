/** 파서 공통 헬퍼 */
import type { Page } from "playwright";
import type { RawProduct } from "../lib/types";
import { politeDelay } from "../lib/manners";

/** "12,500원" 등에서 정수 추출.
 *  일부 몰(예: upick=Cafe24)은 가격 요소 안에 할인율 배지가 중첩된다:
 *  <strong id=span_product_price_text>14,000원<div class=sale_box>53%</div></strong>
 *  → textContent "14,000원53%" → 종전 방식은 1400053으로 오염. 그래서 '원'으로 끝나는
 *  첫 금액 토큰만 취하고, '원'이 없으면 종전처럼 전체 숫자를 추출한다(폴백). */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const won = raw.match(/([\d,]+)\s*원/);
  const digits = (won ? won[1] : raw).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

/** 셀렉터 세트 (사이트별로 값만 교체) */
export interface SiteSelectors {
  loginUrl: string;
  loginId: string;
  loginPw: string;
  loginSubmit: string;
  loginSuccess: string;
  listUrl: string;
  /** 전 카테고리 순회용 CSS 셀렉터: listUrl 페이지 네비에서 카테고리 링크를 뽑음.
   *  있으면 발견된 모든 카테고리를 순회, 없으면 listUrl 하나만(백워드 호환). */
  categoryLink?: string;
  productLink: string;
  name: string;
  price: string;
  image: string;
  detail: string;
}

/** 로그인 → 목록 순회 → 상세 파싱 공통 구현 (사이트별 셀렉터만 주입) */
export async function loginWith(
  page: Page,
  sel: SiteSelectors,
  creds: { id: string; pw: string },
): Promise<void> {
  await page.goto(sel.loginUrl, { waitUntil: "domcontentloaded" });
  await page.fill(sel.loginId, creds.id);
  await page.fill(sel.loginPw, creds.pw);
  await page.click(sel.loginSubmit);
  await page.waitForSelector(sel.loginSuccess, { timeout: 15000 });
}

/** 목록 URL에 page 쿼리 파라미터를 설정(교체). Cafe24·Godo·영카트 모두 page=N 페이지네이션. */
function withPageParam(listUrl: string, n: number): string {
  const u = new URL(listUrl);
  u.searchParams.set("page", String(n));
  return u.toString();
}

/** 목록 페이지 순회 안전 상한(무한 루프 방지). */
const MAX_LIST_PAGES = 100;

/** listUrl 페이지 네비에서 카테고리 URL 목록을 뽑는다(categoryLink 없으면 listUrl 하나). */
async function discoverCategoryUrls(
  page: Page,
  sel: SiteSelectors,
): Promise<string[]> {
  if (!sel.categoryLink) return [sel.listUrl];
  await page.goto(sel.listUrl, { waitUntil: "domcontentloaded" });
  const found = await page.$$eval(sel.categoryLink, (els) =>
    els.map((e) => (e as HTMLAnchorElement).href),
  );
  const uniq = [...new Set(found)].filter(Boolean);
  return uniq.length ? uniq : [sel.listUrl];
}

/** (전 카테고리 ×) 페이지별로 순회하며 상세 URL 수집.
 *  카테고리 넘나드는 중복 상품은 전역 dedupe로 한 번만 상세 크롤.
 *  카테고리 종료 판정은 dedupe와 무관하게 "빈 페이지 또는 직전 페이지와 동일"로 한다
 *  (겹침 때문에 조기 종료되는 것을 방지). limit 도달 시 즉시 반환. */
export async function listUrlsWith(
  page: Page,
  sel: SiteSelectors,
  limit: number,
): Promise<string[]> {
  const categoryUrls = await discoverCategoryUrls(page, sel);
  if (sel.categoryLink) console.log(`    카테고리 ${categoryUrls.length}개 발견`);

  const collected: string[] = [];
  const seen = new Set<string>();
  for (const catUrl of categoryUrls) {
    let prevKey = "";
    for (let pageNo = 1; pageNo <= MAX_LIST_PAGES; pageNo++) {
      let hrefs: string[];
      try {
        await page.goto(withPageParam(catUrl, pageNo), {
          waitUntil: "domcontentloaded",
        });
        hrefs = (
          await page.$$eval(sel.productLink, (els) =>
            els.map((e) => (e as HTMLAnchorElement).href),
          )
        ).filter(Boolean);
      } catch {
        break; // 개별 페이지 오류(리다이렉트로 컨텍스트 파괴·타임아웃) → 이 카테고리만 스킵하고 계속
      }
      // 카테고리 접근이 로그인/로그아웃으로 튕기면 세션 종료로 보고, 지금까지 수집분으로 중단
      if (/Member\/logout|\/member\/login|\/bbs\/login/i.test(page.url())) return collected;
      if (hrefs.length === 0) break; // 빈 페이지 = 카테고리 끝
      const key = [...hrefs].sort().join("|");
      if (key === prevKey) break; // 직전 페이지와 동일 = page 무시/마지막 페이지 클램프
      prevKey = key;
      for (const h of hrefs) {
        if (seen.has(h)) continue; // 다른 카테고리에서 이미 수집 → 상세 중복 방지
        seen.add(h);
        collected.push(h);
        if (collected.length >= limit) return collected;
      }
      await politeDelay(); // 페이지 사이 매너 딜레이
    }
  }
  return collected;
}

export async function parseProductWith(
  page: Page,
  sel: SiteSelectors,
  url: string,
): Promise<RawProduct> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const name = (await page.textContent(sel.name))?.trim() ?? "(이름 파싱 실패)";
  const priceWholesale = parsePrice(await page.textContent(sel.price));
  const detailText = (await page.textContent(sel.detail))?.trim() ?? "";
  // 지연로딩(lazy) 이미지 대응: data-src 우선, 없으면 src
  const imageEl = page.locator(sel.image).first();
  const imageUrl =
    (await imageEl.getAttribute("data-src").catch(() => null)) ||
    (await imageEl.getAttribute("src").catch(() => null)) ||
    null;
  return { sourceUrl: url, name, priceWholesale, imageUrl, detailText };
}
