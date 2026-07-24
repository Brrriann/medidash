/**
 * 도매몰 파서 인터페이스 (docs/SPEC.md §6.2)
 * 사이트당 파서 모듈을 분리해, 사이트 개편 시 파서만 교체 가능하게 한다(§11).
 *
 * ⚠️ 실제 셀렉터는 계정 로그인 후 실사이트 DOM을 대조해 채워야 한다(현재 TODO 표기).
 *    dry-run 모드에서는 fixture()가 픽스처를 생성하므로 계정·네트워크 없이 파이프라인 검증 가능.
 */
import type { Page } from "playwright";
import type { RawProduct, WholesaleSource } from "../lib/types";
import type { Credentials } from "../lib/env";

export interface WholesaleParser {
  source: WholesaleSource;
  label: string;
  baseUrl: string;

  /** 셀러 계정 로그인 (세션 확보) */
  login(page: Page, creds: Credentials): Promise<void>;

  /** 상품 목록을 순회하며 상세 URL을 최대 limit개 반환 */
  listProductUrls(page: Page, limit: number): Promise<string[]>;

  /** 상세 페이지에서 상품 데이터 파싱 */
  parseProduct(page: Page, url: string): Promise<RawProduct>;

  /** dry-run용 픽스처 — 실사이트 없이 limit개 가짜 상품 생성 */
  fixture(limit: number): RawProduct[];
}
