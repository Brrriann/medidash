/**
 * 유픽B2B (upickb2b.com) 파서 — docs/SPEC.md §6.2
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

// 실사이트 DOM 대조 완료(2026-07-24) — upickb2b는 Cafe24 기반.
// 목록/상세는 Aside(로그인 세션)로, 로그인 폼은 Playwright 비로그인 캡처로 실측.
const SELECTORS: SiteSelectors = {
  loginUrl: "https://upickb2b.com/member/login.html",
  loginId: "#member_id",
  loginPw: "#member_passwd",
  loginSubmit: "a.btnSubmit",
  loginSuccess: 'a[href*="Member/logout"]',
  listUrl: "https://upickb2b.com/category/%EA%B1%B4%EA%B0%95%EA%B8%B0%EB%8A%A5%EC%8B%9D%ED%92%88/24/",
  // 전 카테고리 순회: 네비의 /category/ 링크(상품 URL도 /category/ 포함 → /product/ 제외)
  categoryLink: 'a[href*="/category/"]:not([href*="/product/"])',
  productLink: '.prdList li[id^="anchorBoxId_"] .name a',
  name: ".headingArea h1",
  price: "#span_product_price_text",
  image: ".imgArea .prdImg img",
  detail: "#prdDetail",
};

export const upickb2bParser: WholesaleParser = {
  source: "upickb2b",
  label: "유픽B2B",
  baseUrl: "https://upickb2b.com",

  login(page: Page, creds: Credentials) {
    return loginWith(page, SELECTORS, creds);
  },
  listProductUrls(page: Page, limit: number) {
    return listUrlsWith(page, SELECTORS, limit);
  },
  parseProduct(page: Page, url: string): Promise<RawProduct> {
    return parseProductWith(page, SELECTORS, url);
  },
  fixture(limit: number): RawProduct[] {
    return makeFixtures("upickb2b", limit);
  },
};
