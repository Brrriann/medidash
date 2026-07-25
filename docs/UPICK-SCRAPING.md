# 유픽(upickb2b) 스크래핑 작업지시서

> **목적**: `upickb2b.com`의 **전 상품**을 스크래핑해 medidash Supabase(`medidash.wholesale_products`)에 적재한다.
> ggsan(1,894건)·gonyb2b(810건)은 medidash 내장 크롤러로 **이미 완료**됐고, **유픽만 남았다**(현재 3건 → 실제 수천 건).
> 이 문서는 외부 스크래핑 툴/작업자가 그대로 따라 하도록 실측값(로그인·셀렉터·스키마)을 정리한 것이다.

---

## 0. 대상 개요
| 항목 | 값 |
|---|---|
| 사이트 | https://upickb2b.com |
| 플랫폼 | **Cafe24** (한국 쇼핑몰 솔루션) — 셀렉터가 Cafe24 표준 구조 |
| 로그인 | **필수** (도매가는 회원에게만 노출) |
| 규모 | 카테고리 약 80+개, 상품 수천 건(중복 제외) |
| 딜레이 | 요청 간 **2~5초**, 동시성 1 (계정 차단 방지 — 낮추지 말 것) |

---

## 1. 로그인
| 항목 | 값 |
|---|---|
| 로그인 URL | `https://upickb2b.com/member/login.html` |
| 아이디 입력칸 | `#member_id` |
| 비밀번호 입력칸 | `#member_passwd` |
| 로그인 버튼 | `a.btnSubmit` (클릭 시 Cafe24 `MemberAction.login()` 실행 → 폼 제출) |
| 로그인 성공 판정 | 페이지에 `a[href*="Member/logout"]`(로그아웃 링크)가 보이면 성공. 실패하면 `login.html`에 그대로 머묾 |
| 계정 | **사장님 유픽 계정** — 이 문서/채팅에 적지 말 것. 툴의 시크릿 또는 `.env.local`에만 |

> ⚠️ **로그인 레이트리밋 (중요)**: 짧은 시간에 반복 로그인하면 잠긴다(캡차·에러 메시지 없이 조용히 실패). 
> → **한 세션에 로그인 1회**만. 실패하면 **수십 분 이상 쉬고** 재시도. 자동 재시도를 촘촘히 돌리면 잠금이 계속 연장된다.

---

## 2. 카테고리 수집 (전 카테고리 순회)
로그인 후, 아무 페이지(홈 또는 카테고리 페이지)의 상단 네비에서 카테고리 링크를 모은다.

- **카테고리 링크 셀렉터**: `a[href*="/category/"]:not([href*="/product/"])`
  - (상품 상세 URL도 경로에 `/category/`가 들어가므로 `/product/` 포함 링크는 반드시 제외)
- **카테고리 URL 형태**: `https://upickb2b.com/category/<이름>/<번호>/` (약 80+개)
- 번호로 중복 제거(같은 번호 = 같은 카테고리)

> ⚠️ **번호만으로 URL을 조립하지 말 것**. `/category/x/29/`처럼 이름을 임의로 넣으면 Cafe24가 **로그아웃 리다이렉트**(`.../Member/logout?err_code`)를 일으킨다. 반드시 **네비에서 뽑은 실제 URL 그대로** 사용.

---

## 3. 상품 목록 + 페이지네이션
각 카테고리 URL을 열어 상품 상세 링크를 모은다.

- **상품 링크 셀렉터**: `.prdList li[id^="anchorBoxId_"] .name a`
- **상품 URL 형태**: `/product/<이름>/<상품번호>/category/<카테번호>/display/<n>/`
- **페이지네이션**: URL 쿼리에 `?page=N` 추가 → `page=1, 2, 3 …`
  - **종료 조건(카테고리 끝)**: 그 페이지에 상품 링크가 0개거나, **직전 페이지와 상품 목록이 동일**하면(더 넘겨도 안 바뀜) 그 카테고리 종료
- **전역 중복 제거**: 한 상품이 여러 카테고리에 겹쳐 나올 수 있다 → **`source_url`(상품 URL) 기준으로 dedupe**해서 같은 상품 상세는 **1회만** 방문

---

## 4. 상품 상세 — 긁을 필드 (상품당)
| 필드 | 셀렉터 | 처리 |
|---|---|---|
| `source_url` | (그 상세 페이지 URL 자체) | 고유키 |
| `name` | `.headingArea h1` | 텍스트 trim |
| `price_wholesale` | `#span_product_price_text` | ⚠️ **아래 "가격 처리" 참고** — 정수로 |
| `image_url` | `.imgArea .prdImg img` | `src`(지연로딩이면 `data-src` 우선) |
| `detail` | `#prdDetail` | 상세설명 텍스트 (선택, 원료매칭용) |

### ⚠️ 가격 처리 (반드시)
`#span_product_price_text` 안에는 **할인율 배지가 중첩**된다:
```html
<strong id="span_product_price_text">14,000원<div class="sale_box">53%</div></strong>
```
- textContent = `"14,000원53%"` → 그냥 숫자만 뽑으면 `1400053`으로 **오염**된다.
- **'원'으로 끝나는 첫 금액 토큰만** 취해라: 정규식 `([\d,]+)\s*원` → `"14,000"` → 쉼표 제거 → `14000`.

---

## 5. 출력 스키마 → `medidash.wholesale_products`
```sql
source          text   -- 'upickb2b' 고정
source_url      text   -- 상품 URL (UNIQUE = 중복키)
name            text
price_wholesale int    -- 정수 (원·쉼표·할인율% 제거 후)
image_url       text
detail          jsonb  -- {"text": "상세설명 텍스트"}
ingredient_ids  int[]  -- 비워둘 것(null). medidash가 name+detail로 자동 매칭
crawled_at      timestamptz  -- 적재 시각(ISO8601)
```
- **적재 방식**: `source_url` 충돌 시 **UPSERT**(덮어쓰기). 재실행해도 중복 안 생김.
- **접속 키**: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (medidash `.env.local`에 있음). 스키마는 `medidash`.
- CSV/JSON로 먼저 뽑아도 됨 → 위 컬럼명·타입에 맞춰 medidash 쪽에서 적재 지원 가능.

---

## 6. 검증 (완료 후)
- 적재 건수 확인, **가격 0/누락 0 · 이미지 누락 0** 확인
- medidash 배포 대시보드 **소싱** 화면(로그인 후)에 유픽 상품이 뜨는지 확인
  - (참고: 소싱 화면은 현재 최신 200건까지만 표시 — 전량 보이게 하려면 medidash `getWholesaleProducts`의 `.limit(200)` 상향 필요)

---

## 7. 요약 체크리스트
- [ ] 로그인 1회 성공 (`a[href*="Member/logout"]` 확인), 레이트리밋 주의
- [ ] `a[href*="/category/"]:not([href*="/product/"])`로 전 카테고리 URL 수집
- [ ] 각 카테고리 `?page=N` 순회, 빈/동일 페이지에서 종료
- [ ] 상품 URL 전역 dedupe
- [ ] 상세에서 name·price(원 앞 숫자만)·image·detail 추출
- [ ] 2~5초 딜레이 유지
- [ ] `source='upickb2b'`로 `wholesale_products` UPSERT

> 셀렉터·플랫폼 quirks 원본 정리: 같은 레포 [`docs/CRAWL-SELECTORS.md`](CRAWL-SELECTORS.md)
