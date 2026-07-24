# 도매몰 파서 셀렉터 — 실측 결과 & 플랫폼별 주의사항

`docs/CRAWL-LOCAL.md`의 §2(셀렉터 채우기)를 3사에 대해 완료한 결과 기록.
2026-07-24 기준 세 사이트 모두 `npm run crawl -- --source=<X> --limit=3` 검증 완료(이름·가격·이미지 정상 적재).

> 실제 셀렉터 값은 `workers/parsers/{upickb2b,ggsan,gonyb2b}.ts` 의 `SELECTORS` 에 있음.
> 이 문서는 **왜 그렇게 됐는지(플랫폼·quirks)** 를 남겨, 사이트 개편 시 재작업을 돕는 용도.

## 플랫폼이 3사 제각각

| 몰 | 플랫폼 | 로그인 | 목록 | 상세 |
|---|---|---|---|---|
| 유픽 (upickb2b.com) | **Cafe24** | `/member/login.html` → `/exec/front/Member/login/` | `/category/<name>/<no>/` | `/product/.../<no>/...` |
| 건강산 (www.ggsan.com) | **Godo(고도몰)** | `/member/login.php` → `/member/login_ps.php` | `/goods/goods_list.php?cateCd=` | `/goods/goods_view.php?goodsNo=` |
| 건온연 (gonyb2b.com) | **영카트(Youngcart/그누보드)** | `/bbs/login.php` → `/bbs/login_check.php` | `/shop/list.php?ca_id=` | `/shop/item.php?it_id=` |

## 사이트별 quirk (실측하며 걸린 것들)

### 유픽 (Cafe24)
- 로그인 폼은 **로그인 상태에서 렌더되지 않음** → 로그인 셀렉터는 Playwright 비로그인 캡처로 실측(`npm run crawl:inspect --url=<loginUrl>`, 계정 불필요). 목록·상세는 로그인 세션으로.
- **가격 오염**: 상세 `#span_product_price_text` 안에 할인율 배지 `<div class="sale_box">53%</div>` 가 중첩 → textContent `"14,000원53%"`. → `shared.ts` `parsePrice` 가 **'원'으로 끝나는 첫 금액 토큰만** 취하도록 처리(`tests/parse-price.test.ts`).
- **로그인 레이트리밋**: 짧은 시간에 반복 로그인하면 잠깐 로그인이 막힘(캡차·alert 없이 `login.html` 에 머묾). 자동 크롤/디버깅은 쿨다운(~3분) 후 단독 로그인 1회로. **월 1회 실사용(로그인 1번)엔 무관.**

### 건강산 (Godo)
- 로그인 필드 `#loginId`/`#loginPwd` 가 숨은 `formOrderLogin` 에도 **중복 존재** → `#formLogin` 으로 스코프해야 strict-mode 충돌 없음.
- 가격 `.item_price` 가 **연관상품 영역에도 11개** 존재 → 메인 상품 정보 박스 `.item_info_box .item_price dd` 로 스코프.

### 건온연 (영카트)
- 표시가격 `#sit_tot_price` 는 **JS로만 채워져 초기엔 비어 있음** → 판매가격 행(hidden `#it_price` 를 품은 `td`)을 `td:has(#it_price) strong` 으로 집음.
- 상품명 `#sit_title` 끝에 스크린리더용 `<span class="sound_only"> 요약정보 및 구매</span>` 접미사가 붙음 → 셀렉터로는 분리 불가라 `gonyb2b.ts` `parseProduct` 에서 정규식으로 제거.
- 목록 스킨(bobusang)이 커스텀이라 기본 `.sct_li` 아님 → 메인 그리드는 단일 `.product` 래퍼, 상품 링크는 `.product .img a`(‘최근본상품’ 스와이퍼와 구분).

## 셀렉터 실측 방법 (재작업 시)
1. **로그인 폼**: `npm run crawl:inspect -- --source=<X> --url=<로그인URL>` (계정 불필요, 비로그인 렌더 캡처 → `workers/.inspect/`).
2. **목록·상세 구조**: 로그인된 브라우저 세션으로 실제 DOM 확인(로그인 상태에서만 보이는 도매가 등).
3. **JS 렌더/로그인 전용 가격**: 최종 확인은 `npm run crawl -- --source=<X> --limit=3` 결과로.
