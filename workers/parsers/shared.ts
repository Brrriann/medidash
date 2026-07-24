/** 파서 공통 헬퍼 */
import type { Page } from "playwright";
import type { RawProduct } from "../lib/types";

/** "12,500원" 등에서 정수 추출 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
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
