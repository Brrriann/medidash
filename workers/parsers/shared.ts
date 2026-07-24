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

/** 목록을 페이지별로 순회하며 상세 URL 수집. limit 도달 또는 새 링크 없음(마지막 페이지)에서 종료. */
export async function listUrlsWith(
  page: Page,
  sel: SiteSelectors,
  limit: number,
): Promise<string[]> {
  const collected: string[] = [];
  const seen = new Set<string>();
  let pageNo = 1;
  for (; pageNo <= MAX_LIST_PAGES; pageNo++) {
    await page.goto(withPageParam(sel.listUrl, pageNo), {
      waitUntil: "domcontentloaded",
    });
    const hrefs = (
      await page.$$eval(sel.productLink, (els) =>
        els.map((e) => (e as HTMLAnchorElement).href),
      )
    ).filter(Boolean);
    // 새 링크가 없으면 마지막 페이지를 지났거나 page 파라미터가 무시된 것 → 종료
    const fresh = hrefs.filter((h) => !seen.has(h));
    if (fresh.length === 0) break;
    for (const h of fresh) {
      seen.add(h);
      collected.push(h);
      if (collected.length >= limit) return collected;
    }
    await politeDelay(); // 목록 페이지 사이에도 매너 딜레이
  }
  if (pageNo > MAX_LIST_PAGES) {
    console.warn(
      `    ⚠️ 목록 페이지 상한(${MAX_LIST_PAGES}p) 도달 — 이후 페이지는 수집되지 않음`,
    );
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
