/**
 * 건온연B2B (gonyb2b.com) 파서 — docs/SPEC.md §6.2
 * ⚠️ SELECTORS는 플레이스홀더. 계정 로그인 후 실사이트 DOM을 대조해 TODO를 채운다.
 */
import type { Page } from "playwright";
import type { RawProduct } from "../lib/types";
import type { Credentials } from "../lib/env";
import type { WholesaleParser } from "./types";
import {
  loginWith,
  listUrlsWith,
  parseProductWith,
  type SiteSelectors,
} from "./shared";
import { makeFixtures } from "./fixtures";

// 실사이트 DOM 대조 완료(2026-07-24) — gonyb2b는 영카트(Youngcart/그누보드) 기반.
// 로그인 폼은 Playwright 비로그인 캡처로, 목록/상세는 Aside(로그인 세션)로 실측.
const SELECTORS: SiteSelectors = {
  loginUrl: "https://gonyb2b.com/bbs/login.php",
  loginId: "#login_id",
  loginPw: "#login_pw",
  loginSubmit: "form[name=\"flogin\"] button[type=\"submit\"]",
  loginSuccess: 'a[href*="logout.php"]',
  listUrl: "https://gonyb2b.com/shop/list.php?ca_id=10",
  // 전 카테고리 순회: 네비의 list.php?ca_id= 링크(상품은 item.php?it_id=라 구분됨)
  categoryLink: 'a[href*="list.php?ca_id="]',
  productLink: ".product .img a",
  name: "#sit_title",
  price: "td:has(#it_price) strong", // 판매가격 행(hidden #it_price 포함)의 금액. #sit_tot_price는 JS로만 채워져 비어있음
  image: "#sit_pvi_big img",
  detail: "#sit_inf_explan",
};

export const gonyb2bParser: WholesaleParser = {
  source: "gonyb2b",
  label: "건온연B2B",
  baseUrl: "https://gonyb2b.com",

  login(page: Page, creds: Credentials) {
    return loginWith(page, SELECTORS, creds);
  },
  listProductUrls(page: Page, limit: number) {
    return listUrlsWith(page, SELECTORS, limit);
  },
  async parseProduct(page: Page, url: string): Promise<RawProduct> {
    const p = await parseProductWith(page, SELECTORS, url);
    // 영카트 #sit_title 끝의 스크린리더용 " 요약정보 및 구매" 접미사 제거 (셀렉터로는 분리 불가)
    return { ...p, name: p.name.replace(/\s*요약정보 및 구매\s*$/, "").trim() };
  },
  fixture(limit: number): RawProduct[] {
    return makeFixtures("gonyb2b", limit);
  },
};
