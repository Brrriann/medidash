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

// TODO(계정 수령 후): 실사이트에서 확인해 교체
const SELECTORS: SiteSelectors = {
  loginId: "input[name=loginId]",
  loginPw: "input[name=loginPwd]",
  loginSubmit: "button.login-btn",
  loginSuccess: ".logout-btn",
  listUrl: "https://upickb2b.com/product/list",
  productLink: ".prd-list a.prd-link",
  name: ".prd-detail .title",
  price: ".prd-detail .price",
  image: ".prd-detail .thumb img",
  detail: ".prd-detail .description",
};

export const upickb2bParser: WholesaleParser = {
  source: "upickb2b",
  label: "유픽B2B",
  baseUrl: "https://upickb2b.com",

  login(page: Page, creds: Credentials) {
    return loginWith(page, this.baseUrl, SELECTORS, creds);
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
