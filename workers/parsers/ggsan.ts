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

// 실사이트 DOM 대조 완료(2026-07-24) — ggsan은 Godo(고도몰) 기반.
// 로그인 폼은 Playwright 비로그인 캡처로, 목록/상세는 Aside(로그인 세션)로 실측.
// 로그인 필드 id(loginId/loginPwd)가 숨은 formOrderLogin에도 중복이라 #formLogin으로 스코프.
const SELECTORS: SiteSelectors = {
  loginUrl: "https://www.ggsan.com/member/login.php",
  loginId: "#formLogin #loginId",
  loginPw: "#formLogin #loginPwd",
  loginSubmit: "#formLogin button[type=\"submit\"]",
  loginSuccess: 'a[href*="logout.php"]',
  listUrl: "https://www.ggsan.com/goods/goods_list.php?cateCd=001",
  // 전 카테고리 순회: 네비의 goods_list.php?cateCd= 링크(상품은 goods_view.php라 구분됨)
  categoryLink: 'a[href*="goods_list.php?cateCd="]',
  productLink: '.item_info_cont a[href*="goods_view.php"]',
  name: ".item_detail_tit h3",
  price: ".item_info_box .item_price dd", // .item_price는 연관상품에도 11개 → 메인 정보박스로 스코프
  image: ".item_photo_big img",
  detail: "#detail",
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
