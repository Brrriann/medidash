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

// TODO(계정 수령 후): 실사이트에서 확인해 교체
const SELECTORS: SiteSelectors = {
  loginUrl: "https://gonyb2b.com/login", // TODO: 실제 로그인 페이지 URL
  loginId: "#username",
  loginPw: "#password",
  loginSubmit: "button[type=submit]",
  loginSuccess: ".my-account", // 로그인 완료 신호
  listUrl: "https://gonyb2b.com/products",
  productLink: "a.product-item",
  name: "h1.product-title",
  price: ".price .amount",
  image: ".product-image img",
  detail: ".product-detail",
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
  parseProduct(page: Page, url: string): Promise<RawProduct> {
    return parseProductWith(page, SELECTORS, url);
  },
  fixture(limit: number): RawProduct[] {
    return makeFixtures("gonyb2b", limit);
  },
};
