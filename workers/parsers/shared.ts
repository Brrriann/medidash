/** 파서 공통 헬퍼 */
import type { Page } from "playwright";
import type { RawProduct } from "../lib/types";

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

export async function listUrlsWith(
  page: Page,
  sel: SiteSelectors,
  limit: number,
): Promise<string[]> {
  await page.goto(sel.listUrl, { waitUntil: "domcontentloaded" });
  // TODO: 페이지네이션 순회. 현재는 첫 페이지의 링크만 수집.
  const hrefs = await page.$$eval(sel.productLink, (els) =>
    els.map((e) => (e as HTMLAnchorElement).href),
  );
  return hrefs.slice(0, limit);
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
