# 인수인계 문서 — 헬스셀러 (health-seller.com)

이 문서 하나로 서비스를 넘겨받아 운영·개발할 수 있게 쓴 것입니다. 계정 권한 이관 절차는
[`HANDOVER-accounts.md`](HANDOVER-accounts.md), 기능 명세는 [`SPEC.md`](SPEC.md)를 봅니다.

---

## 1. 서비스가 하는 일

건강기능식품을 **위탁판매**하는 셀러를 위한 업무 도구입니다. 셀러의 작업 순서를 그대로
메뉴 구조로 만들었습니다.

```
찾기            만들기              정산
증상 지도   →   썸네일          →   마진 계산
상품 소싱       상품명·태그
```

| 메뉴 | 경로 | 하는 일 |
|---|---|---|
| 홈 | `/` | "오늘 할 작업" 런처 + 홈쇼핑 트렌드 + 최근 작업 |
| 증상 지도 | `/map` | 인체 지도 → 부위 → 증상 → 추천 원료 |
| 상품 소싱 | `/sourcing` | 도매 3사 상품 6,003건 검색 |
| 썸네일 | `/studio` | AI 배경·인물 + 상품 누끼 합성 → PNG |
| 상품명·태그 | `/titles` | 노출도 등급 상품명 + 태그 20개 |
| 마진 계산 | `/margin` | 수수료·세금 뺀 실마진, 손익분기 ROAS |
| 내 계정 | `/my` | 작업 이력 · **AI 생성 이력** · 마진 이력 |
| 관리자 | `/admin` | 수강생 코드 발급 · 회원 관리 |

**수강생 전용입니다.** 로그인만으로는 대시보드가 열리지 않고, `profiles` 행이 있어야
합니다. 그 행은 수강생 코드를 낸 사람에게만 생깁니다.

---

## 2. 기술 구성

| 영역 | 사용 기술 |
|---|---|
| 앱 | Next.js 15 App Router (Server Actions + Route Handlers) |
| 배포 | **OpenNext → Cloudflare Workers** (Node가 아니라 workerd에서 돕니다) |
| DB·인증 | Supabase (`medidash` 스키마, RLS) |
| AI | OpenAI — `gpt-image-1`(이미지), `gpt-4o-mini`(텍스트) |
| 이미지 처리 | Cloudflare Images `segment=foreground` (배경제거) |
| 배치 | GitHub Actions (홈쇼핑 지표 일 1회) |

### 로컬 실행

```bash
npm install
cp .env.example .env.local     # 키 채우기
npm run dev                    # http://localhost:3000
```

**키 없이도 실행됩니다.** Supabase 환경변수가 비면 mock 모드로 뜨고, 로그인 없이 시드
데이터로 전 화면을 볼 수 있습니다. 단 **프로덕션(NODE_ENV=production)에서는 mock으로
떨어지지 않고 즉시 실패합니다** — 설정 실수 하나가 "인증 없는 공개 사이트"가 되는 것을
막기 위해서입니다 (`src/lib/supabase/env.ts`).

```bash
npm run build      # 타입체크 + 빌드
npm test           # 78건
npm run lint
npm run cf:deploy  # Cloudflare 배포 (보통은 main 머지 시 자동)
```

---

## 3. 데이터

### 테이블 (`medidash` 스키마)

| 테이블 | 내용 |
|---|---|
| `body_categories` · `body_subcategories` · `symptom_keywords` | 인체 분류 12계통 |
| `subcategory_contents` · `ingredients` · `symptom_ingredients` | 원료·증상 매핑 (고객 제공 데이터 적재) |
| `wholesale_products` | 도매 3사 상품 캐시 **6,003건** |
| `keyword_stats` | 네이버 검색량·경쟁도 |
| `broadcast_stats` | 홈쇼핑모아 방송 지표 (일 1회 갱신) |
| `profiles` · `invite_codes` | 회원 · 수강생 코드 |
| `works` · `margin_calcs` · `ai_logs` | 작업 이력 · 마진 이력 · AI 호출 이력 |
| `payments` | 결제 (W4 미구현) |

마이그레이션은 `supabase/migrations/` 에 순번대로 있습니다. **Supabase SQL Editor에
붙여넣어 실행하는 방식**으로 운영해 왔습니다.

### 배치 작업

| 작업 | 주기 | 실행 |
|---|---|---|
| 홈쇼핑 지표 | **매일 05:00 KST** | GitHub Actions 자동 |
| 도매몰 상품 | 수동 (월 1회 전제) | `npm run crawl` |
| 원료 재매칭 | 수동 | `npm run rematch` (재크롤 없이 매칭만 다시) |

---

## 4. 넘겨받는 사람이 먼저 알아야 할 것

여기 적힌 것들은 **직접 부딪혀서 알아낸 것**이라 코드만 봐서는 안 보입니다.

### 4-1. 로컬에서 되고 배포에서 깨지는 것들

`workerd`는 Node가 아닙니다. 아래는 전부 로컬 통과 후 프로덕션에서 발견됐습니다.

- **2MB 서버 액션** — 인물 컷아웃(투명 PNG 1.5MB)을 서버 액션으로 돌려주면 조용히 실패합니다. 그래서 `/api/ai/image`가 라우트 핸들러이고 **원본 바이트를 그대로** 내보냅니다.
- **`next.config.ts`의 `headers()`가 무시됩니다** — 정적 자산 캐시는 `public/_headers`로 설정해야 합니다.
- **`/cdn-cgi/image/` 를 서버에서 부르면 안 됩니다** — Worker가 자기 도메인의 그 경로를 fetch하면 엣지를 안 타고 Worker로 되돌아와 원본이 나옵니다. **브라우저가 직접** 불러야 합니다.
- **Durable Object는 `new_sqlite_classes`** — 무료 플랜은 KV 기반 DO를 지원하지 않습니다.

### 4-2. OpenAI가 한국에서 403을 냅니다

한국 트래픽이 Cloudflare 홍콩(HKG) PoP로 나가는데 OpenAI가 홍콩을 차단합니다.
Smart Placement로는 안 풀렸습니다. **`locationHint: "wnam"`으로 북미에 고정한 Durable
Object를 경유**해 해결했습니다 (`worker-entry.ts`, `src/lib/ai/fetch.ts`).
OpenAI 호출만 이 경로를 타고 나머지는 사용자 근처 엣지에서 처리됩니다.

### 4-3. 상품 이미지를 AI로 편집하면 안 됩니다

`gpt-image-1`의 편집은 편집이 아니라 재생성이라 **패키지의 한글 표시사항이 깨집니다.**
실측에서 **"종근당" → "증근당"** 이 나왔습니다. 표시광고법·상표법 위반 소지라
**상품 이미지는 합성만** 합니다. 인물은 AI가 만든 가상 인물이라 생성해도 됩니다.

### 4-4. 도매몰 상세 텍스트는 쓸 수 없습니다

`wholesale_products.detail.text`는 사실상 비어 있습니다. 3사 실측:

| 몰 | 내용 |
|---|---|
| gonyb2b | 0자 |
| ggsan | 258자 — 전부 `상품상세정보 / 배송안내 / 교환 및 반품안내` 탭 레이블 |
| upickb2b | 0자 |

**원료 매칭에 이 텍스트를 넣으면 안 됩니다.** 판매정책 안내문이라
"블루베리(삼성복지몰)" 같은 오탐이 납니다. 대신 **상품명 파서**(`src/lib/products/parse-name.ts`)로
브랜드·제형·함량·수량을 뽑습니다 — 6,003건 기준 규격 76.2% · 브랜드 91.1%.

### 4-5. 홈쇼핑 편성표는 열흘치만 공개됩니다

예정 편성 325건 실측: 최대 D-9.8, 중앙값 D-0.8, **14일 이상 0건**. 홈쇼핑모아가 상위
10건만 주는 상한 때문이 아닙니다(10건이 꽉 찬 원료보다 전량 수집된 원료가 오히려
더 멀었습니다). **매일 크롤이 이 기능의 전제**입니다 — 월 1회면 대부분을 놓칩니다.

### 4-6. 광고법 가드는 코드에 있습니다

의약품 오인 표현(치료·완치·개선·효과…)은 `src/lib/titles/compliance.ts`의
`sanitize()`가 치환합니다. **AI가 만든 문구는 반드시 이걸 통과시켜야 합니다.**
프롬프트로 금지해도 샙니다. 상품명·태그·후킹 문구 모두 적용돼 있습니다.

### 4-7. 비용 방어

- AI 호출은 **하루 5회**로 제한됩니다 (`AI_DAILY_LIMIT`, 기본값 5, 관리자 제외).
- **유료 호출 직전에 차감**하므로 생성이 실패해도 1회가 빠집니다. 그래서 `ai_logs`에
  성공·실패·한도초과를 모두 기록하고 마이페이지에 보여줍니다.
- 결과물 **원본은 저장하지 않습니다.** 후킹페이지 2장 PNG가 세트당 3MB라 수강생 50명이
  하루 2세트만 만들어도 월 9GB가 됩니다. 512px WebP 미리보기(세트당 80KB)만 남깁니다.

---

## 5. 범위 밖 (구현하지 않기로 한 것)

[`SPEC.md`](SPEC.md) §2 원문을 따릅니다. 요청이 들어와도 계약 확인 없이 만들지 않습니다.

- ❌ **크레딧 차감형 과금** — 2차 계약. PG 단건 결제까지만
- ❌ 도매몰·홈쇼핑모아 **실시간** 연동 — 배치만
- ❌ 부위 13개 이상 확장 UI — 12개 고정
- ❌ 쿠팡 Wing 자동 업로드 — 복사·다운로드까지
- ❌ 부위별 원료·기전·셀링포인트 **콘텐츠 창작** — 고객 제공 데이터 적재만

> **셀러 자신의 상품 문구**(상품명·태그·썸네일·후킹페이지)는 이 가드 밖입니다.
> 금지 대상은 증상 지도에 적재하는 시드 콘텐츠입니다.

---

## 6. 미완 작업

| 우선도 | 내용 |
|---|---|
| 🔴 | **Supabase Pro 전환** — 무료 플랜은 1주 미사용 시 프로젝트 자동 정지. 수강생 오픈 전 필수 |
| 🟡 | 소셜 로그인 (카카오·구글) — 코드 완료, **제공자 설정 대기** ([RUNBOOK](RUNBOOK-oauth-setup.md)) |
| 🟡 | 후킹페이지 화면 — 백엔드(파서·컨텍스트·문구 생성) 완료, 렌더링 UI 미구현 |
| 🟡 | 미리보기 저장 — `previews` 버킷 생성 완료, 업로드 미구현 |
| 🟡 | SSR 캐싱(ISR) — 페이지마다 Supabase 조회 |
| 🟢 | 토스 결제 (W4) |
| 🟢 | 도매몰 `상품필수 정보` 파서 — 인증·섭취방법 확보용 (4-4 참고) |
| 🟢 | CI 게이트 — lint·test가 자동 실행되지 않습니다 (Workers Builds만) |

---

## 7. 문서 목록

| 문서 | 내용 |
|---|---|
| [`SPEC.md`](SPEC.md) | 기능 명세 · 범위 가드 |
| [`DEPLOY.md`](DEPLOY.md) | 배포 절차 (브라우저만으로) |
| [`HANDOVER-accounts.md`](HANDOVER-accounts.md) | 계정 이관·권한 요청 |
| [`RUNBOOK-oauth-setup.md`](RUNBOOK-oauth-setup.md) | 소셜 로그인 설정 지시서 |
| [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) | 오픈 전 점검 항목 |
| [`CRAWL-LOCAL.md`](CRAWL-LOCAL.md) · [`CRAWL-SELECTORS.md`](CRAWL-SELECTORS.md) | 크롤러 실행·셀렉터 |
| [`UX-MAP.md`](UX-MAP.md) · [`UI-PLAN.md`](UI-PLAN.md) | 화면 흐름·디자인 |
