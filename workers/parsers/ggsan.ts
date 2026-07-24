/**
 * 건강산 (ggsan.com) 파서 — docs/SPEC.md §6.2
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
  loginUrl: "https://www.ggsan.com/member/login.php", // TODO: 실제 로그인 페이지 URL
  loginId: "#member_id",
  loginPw: "#member_pw",
  loginSubmit: ".btn-login",
  loginSuccess: ".member-info",
  listUrl: "https://www.ggsan.com/goods/goods_list.php",
  productLink: ".item .name a",
  name: ".goods_name",
  price: ".price strong",
  image: ".goods_image img",
  detail: "#detail_info",
};

export const ggsanParser: WholesaleParser = {
  source: "ggsan",
  label: "건강산",
  baseUrl: "https://www.ggsan.com",

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
    return makeFixtures("ggsan", limit);
  },
};
