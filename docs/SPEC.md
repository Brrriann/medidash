# Health Seller Dashboard — 구축기획서 (Claude Code 실행용)

> 프로젝트: 건강식품 판매 보조 웹대시보드 (에어스유통 김민철 / 계약 MK-202607-C03)
> 이 문서는 Claude Code가 그대로 읽고 구현하기 위한 사양서다. **본 문서의 범위를 벗어나는 기능은 만들지 않는다** (범위 밖 요청은 별도 계약).

---

## 0. 한 줄 개요

초보 건강기능식품 셀러(수강생)가 **인체 지도에서 부위를 클릭 → 추천 원료·셀링포인트 확인 → 도매몰 상품 소싱 → AI 썸네일/상품명/태그 생성 → 마진 계산**까지 원스톱으로 처리하는 반응형 웹 대시보드.

## 1. 기술 스택 (고정)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프론트+백엔드 | **Next.js 15 (App Router, TypeScript)** | 단일 리포 |
| DB/인증 | **Supabase** (PostgreSQL + Auth + Storage) | RLS 사용 |
| 배포 | Cloudflare Pages (또는 Vercel) | 환경변수로 전환 가능하게 |
| 크롤러 | Node (Playwright) — **별도 워커 스크립트** | 월 1회 수동/스케줄 실행 |
| AI 텍스트 | LLM API (Claude 또는 GPT) — 어댑터 패턴으로 추상화 | `lib/ai/text.ts` |
| AI 이미지 | 이미지 생성 API 1종 (기본: OpenAI Images. 어댑터로 교체 가능) | `lib/ai/image.ts` |
| 결제 | **PG 간편연동 1종: 토스페이먼츠(기본) 또는 포트원** | 결제·취소·내역 |
| 스타일 | Tailwind CSS. 화이트 베이스 + 그린/블루 포인트, SaaS 대시보드 톤 | 데스크탑 우선, 태블릿 대응, 모바일은 조회 위주 |

## 2. 범위 가드 (중요 — 구현 금지 목록)

- ❌ **크레딧 차감형 과금 로직**(횟수 관리·차감 정책) — 2차 계약. PG 결제 연동 자체(단건 결제·취소·내역)까지만.
- ❌ 도매몰·홈쇼핑모아 **실시간** 연동 — 갱신은 **월 1회 배치** 기준. 실시간 조회 UI를 만들지 않는다.
- ❌ 부위(카테고리) 13개 이상 확장 UI — **12개 고정** 데이터 구조(추가는 DB에 행만 넣으면 되게 설계).
- ❌ 쿠팡 Wing 자동 업로드 API 연동 — 산출물은 복사/다운로드까지.
- ❌ 부위별 원료/기전/셀링포인트 콘텐츠 창작 — **고객 제공 데이터를 적재**만 한다(시드 스크립트).

## 3. 사용자·인증

- 대상: 수강생/회원. **이메일 + 수강생 코드** 기반 가입.
- 가입 시 `invite_codes` 테이블의 유효 코드 필수. 코드 없으면 가입 불가.
- 역할: `admin`(운영자) / `member`(수강생). admin은 코드 발급·회원 관리·데이터 갱신 실행.
- Supabase Auth(email/password) + RLS: member는 자기 작업물만 읽기/쓰기.

## 4. 데이터 모델 (Supabase SQL)

```sql
-- 부위(카테고리): 12개 시드
create table body_parts (
  id serial primary key,
  slug text unique not null,          -- brain, eye, heart, liver, gut, lung, joint, skin, immune, men, women, diet
  name text not null,                 -- 뇌(인지·기억) 등
  svg_id text not null,               -- 인체 SVG의 영역 id 매핑
  sort int default 0
);

-- 부위별 콘텐츠(고객 제공 데이터 적재)
create table part_contents (
  id serial primary key,
  part_id int references body_parts(id),
  feature text,          -- 부위 특징/설명
  mechanism text,        -- 기전(작용 원리)
  selling_points text[], -- 셀링포인트 문구 배열
  keywords text[]        -- 관련 질환/증상 키워드
);

-- 원료 마스터 + 부위-원료 매핑
create table ingredients (
  id serial primary key,
  name text not null,               -- 쏘팔메토, 콘드로이친 ...
  aliases text[],                   -- 검색 별칭
  note text
);
create table part_ingredients (
  part_id int references body_parts(id),
  ingredient_id int references ingredients(id),
  rank int default 0,
  primary key (part_id, ingredient_id)
);

-- 도매몰 상품 캐시 (월 1회 크롤러가 upsert)
create table wholesale_products (
  id bigserial primary key,
  source text not null check (source in ('gonyb2b','ggsan','upickb2b')),
  source_url text unique not null,
  name text not null,
  price_wholesale int,              -- 도매가(원)
  image_url text,
  detail jsonb,                     -- 원료/함량 등 파싱 결과
  ingredient_ids int[],             -- 매칭된 원료
  crawled_at timestamptz
);

-- 홈쇼핑모아 방송 지표 캐시 (월 1회)
create table broadcast_stats (
  id bigserial primary key,
  keyword text not null,            -- 원료명 or 브랜드명
  kind text check (kind in ('ingredient','brand')),
  broadcast_count int,              -- 방송 노출 횟수
  recent_titles jsonb,              -- 최근 방송 상품명 목록
  crawled_at timestamptz
);

-- 사용자 작업물
create table works (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  kind text check (kind in ('thumbnail','title_tags','margin')),
  input jsonb, output jsonb,
  created_at timestamptz default now()
);

-- 마진 계산 히스토리
create table margin_calcs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  product_ref bigint,               -- wholesale_products.id (nullable)
  inputs jsonb not null,            -- 원가/판매가/수수료율/배송비 ...
  results jsonb not null,           -- 마진율/마진액
  created_at timestamptz default now()
);

-- 가입 코드 / 결제
create table invite_codes (
  code text primary key, memo text, max_uses int default 1, used int default 0, expires_at timestamptz
);
create table payments (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  pg text, order_id text unique, amount int, status text,  -- ready/paid/canceled/failed
  raw jsonb, created_at timestamptz default now()
);
```

## 5. 화면 구성 (8화면)

1. **로그인/회원가입** — 이메일+비밀번호+수강생 코드.
2. **메인 대시보드** — 인체 인터랙티브 지도(중앙) + 최근 작업 이력 + 빠른 메뉴.
3. **부위 상세 패널** (지도 클릭 시 사이드패널/모달) — ①부위 특징 ②추천 원료 칩 ③기전 설명 ④셀링포인트 ⑤질환/증상 키워드 ⑥홈쇼핑모아 방송 지표 ⑦"이 원료로 소싱하기" CTA.
4. **도매몰 통합 검색** — 키워드/원료 검색 → 3사 통합 카드 리스트(사이트별 필터), 카드에 도매가·추천 판매가(기본 도매가×2, 조정 가능)·마진율 미리보기·원본 링크·[썸네일 만들기]·[상품명 만들기] 버튼.
5. **썸네일 스튜디오** — 좌: 실시간 미리보기 캔버스 / 우: 컨트롤(AI 배경 생성, 텍스트 오버레이 블록 추가·드래그, 폰트/크기/색, '건강기능식품' 배지 삽입, 로고 업로드·배치, 사이즈 프리셋: 쿠팡 정방형/스마트스토어/인스타). 흐름: 생성 → 재생성 → 편집 → PNG 다운로드. 저장 시 `works`에 기록.
6. **상품명·태그 추천** — 입력(원료/부위/제품 특징) + 플랫폼 선택(쿠팡/스마트스토어) → 상품명 3~5안(노출도 상/중/하 뱃지) + 태그 20개, 항목별·전체 원클릭 복사.
7. **마진계산기** — 고객 제공 엑셀의 수식·변수를 웹 폼으로 이식. 도매몰 카드에서 진입 시 원가 자동 입력. 계산 결과 저장·히스토리 목록.
8. **마이페이지** — 작업 이력(썸네일/상품명/마진), 계정 관리. (admin: 코드 발급, 회원 목록, 크롤러 실행 버튼·최근 갱신일 표시)

## 6. 핵심 구현 사양

### 6.1 인체 인터랙티브 지도
- **SVG 벡터 방식**. 단일 중성 실루엣 1종(남/녀 전환 없음 — 범위 밖).
- 부위 12개: 뇌 / 눈 / 심장·혈관 / 간 / 위·장 / 폐 / 관절 / 피부 / 면역 / 남성건강 / 여성건강 / 다이어트.
  (남성·여성·다이어트·면역은 신체 위치가 애매하므로 실루엣 옆 라벨 칩으로 배치)
- hover: 영역 하이라이트 + 툴팁(부위명). click: 부위 상세 패널 오픈.
- SVG `id`는 `body_parts.svg_id`와 매핑. 데이터 기반 렌더(부위 추가 시 코드 수정 없이 동작).

### 6.2 도매몰 크롤러 (workers/crawl-wholesale.ts)
- 대상: 건온연B2B(gonyb2b.com), 건강산(ggsan.com), 유픽B2B(upickb2b.com).
- 로그인 세션(계정은 env) → 상품 목록/상세 순회 → `wholesale_products` upsert.
- 파싱: 상품명, 도매가, 이미지 URL, 상세(원료·함량 텍스트). 원료 매칭: `ingredients.aliases` 사전으로 상품명·상세에서 매칭 → `ingredient_ids` 채움.
- **매너 필수**: 요청 간 딜레이 2~5초 랜덤, 동시성 1, 재시도 2회, 실패 로그. 사이트당 파서 모듈 분리(`workers/parsers/{source}.ts`).
- 실행: `npm run crawl` (admin 화면 버튼 → 백그라운드 잡 트리거도 제공). **월 1회 운영** 전제 — cron 자동화는 넣되 기본 off.

### 6.3 홈쇼핑모아 지표 크롤러 (workers/crawl-broadcast.ts)
- `ingredients` 전체 + 주요 브랜드 목록(시드)에 대해 홈쇼핑모아 검색 → 방송 노출 수·최근 방송 상품명 수집 → `broadcast_stats` upsert.
- 표시: 부위 상세 패널(해당 부위 원료들의 방송 지표), 도매몰 검색 결과(키워드 지표 병기).

### 6.4 AI 상품명·태그 (app/api/ai/title-tags)
- 입력: 원료, 부위, 제품명/특징(선택), 플랫폼(coupang|smartstore).
- 출력(JSON 강제): `titles: [{text, exposure: '상'|'중'|'하'}] × 3~5`, `tags: string[20]`.
- 프롬프트 원칙: 플랫폼별 규칙 분기(쿠팡: 브랜드+원료+수량 순 / 스마트스토어: 키워드 조합), **의약품 오인 표현 금지 목록**을 시스템 프롬프트에 포함(치료·완치·예방 등 금지어 → 대체 표현).
- 응답 하단 고지 문구 상수: "AI 초안입니다. 건강기능식품 표시·광고 규정 검수 후 사용하세요."

### 6.5 AI 썸네일 (app/api/ai/thumbnail + 클라이언트 캔버스)
- 서버: 이미지 생성 API 호출(프롬프트에 원료 특징 반영. 예: 콘드로이친 → 무릎 짚은 중년 모델). 생성 이미지는 Supabase Storage 저장.
- 클라이언트: 캔버스 합성(생성 배경 + 텍스트 블록 + '건강기능식품' 배지 + 로고). 라이브러리: `fabric.js` 또는 순수 canvas — 블록 드래그·편집.
- 다운로드: 선택 프리셋 크기로 PNG 내보내기.

### 6.6 마진계산기
- 착수 시 고객 엑셀 수령 → 수식을 `lib/margin.ts` 순수 함수로 이식(단위 테스트 필수).
- 입력: 원가(도매가 자동), 판매가, 플랫폼 수수료율, 배송비, 기타비용. 출력: 마진액·마진율·손익분기 판매가.
- 결과 저장 → 히스토리.

### 6.7 PG 결제 (app/api/pay/*)
- 토스페이먼츠 결제위젯 간편연동: 결제 생성 → 승인 콜백 → `payments` 기록 → 취소 API. (무엇을 파는지는 admin이 금액·상품명 지정하는 단건 결제 — 예: 수강권. 크레딧 차감 로직 없음.)

## 7. 환경변수 (.env.example 로 제공)

```
NEXT_PUBLIC_SUPABASE_URL= / SUPABASE_SERVICE_ROLE_KEY=
AI_TEXT_PROVIDER=anthropic  AI_TEXT_API_KEY=
AI_IMAGE_PROVIDER=openai    AI_IMAGE_API_KEY=
GONYB2B_ID= GONYB2B_PW= / GGSAN_ID= GGSAN_PW= / UPICKB2B_ID= UPICKB2B_PW=
TOSS_CLIENT_KEY= TOSS_SECRET_KEY=
```

## 8. 고객 제공 자료 (착수 시 수령 → 시드)

- 부위별 원료/기전/셀링포인트 데이터 → `scripts/seed-contents.ts`로 적재 (CSV/엑셀 → part_contents, ingredients, part_ingredients)
- 엑셀 마진계산기 파일 → 6.6 수식 이식의 원본
- 도매몰 3곳 계정, 홈쇼핑모아 접근 계정(필요 시), 로고 파일, PG 가맹 키

## 9. 구현 순서 (4주 마일스톤 — Claude Code 작업 단위)

**Week 1 — 골격 + 지도**
1. Next.js+Supabase 프로젝트 셋업, 스키마 마이그레이션, 시드 스크립트(부위 12·원료 더미)
2. 인증(가입 코드)·역할·RLS, 레이아웃/네비
3. 인체 SVG 지도 + 부위 상세 패널(더미 데이터 렌더)

**Week 2 — 데이터 파이프라인**
4. 도매몰 파서 3종 + 크롤러 워커 + admin 실행 버튼 (실계정으로 소량 검증)
5. 홈쇼핑모아 지표 크롤러 + 패널/검색 결과 표시
6. 도매몰 통합 검색 화면(필터·카드·추천 판매가)

**Week 3 — AI + 계산기**
7. 상품명·태그 API + 화면(복사 UX, 금지어 필터)
8. 썸네일 스튜디오(생성 API + 캔버스 편집 + 프리셋 다운로드)
9. 마진계산기(엑셀 수식 이식 + 단위 테스트 + 자동 원가 연동 + 히스토리)

**Week 4 — 결제 + 마감**
10. PG 결제 연동(결제·취소·내역) + 마이페이지/admin 마무리
11. 고객 실데이터 시드 적재, 반응형 점검, E2E 스모크(가입→지도→소싱→썸네일→상품명→마진 저장)
12. 배포 + 운영 가이드(README: 크롤러 실행법·env·시드 방법)

## 10. 완료 기준 (Acceptance Checklist)

- [ ] 수강생 코드 없이 가입 불가, member는 타인 작업물 접근 불가(RLS 테스트)
- [ ] 지도에서 12개 부위 각각 클릭 → 7종 정보 패널 표시(제공 데이터 기준)
- [ ] 도매몰 3사 상품이 통합 검색에 노출되고 원본 링크 이동 가능, 갱신일 표시
- [ ] 원료 칩 클릭 → 해당 원료 매칭 상품 리스트 필터링
- [ ] 상품명 3~5안+노출도, 태그 정확히 20개, 원클릭 복사 동작
- [ ] 썸네일: 생성→텍스트/배지/로고 편집→프리셋 PNG 다운로드
- [ ] 마진계산 결과가 고객 엑셀과 동일 입력 시 동일 출력(±0원, 단위 테스트)
- [ ] PG 테스트 결제·취소 왕복 성공, payments 기록
- [ ] 크롤러 재실행 시 중복 없이 upsert, 실패 시 로그만 남고 서비스 무영향
- [ ] 모든 AI 산출 화면에 규정 검수 고지 문구 노출

## 11. 주의(법·매너)

- 건기식 표시·광고 규제: AI 출력은 초안. 금지어 필터를 코드 레벨에 두되, 최종 책임 고지 문구 필수.
- 크롤링: robots/약관 확인, 저속·야간 실행, 사이트 개편 시 파서만 교체 가능하게 모듈화.
- 도매몰 이미지 사용은 소싱 검토용 표시에 한정(썸네일 배경은 AI 생성 사용).

---

> **구현 노트 (2026-07-22)**: 부위 분류 체계는 본 문서의 12부위 평면 구조 대신
> `docs/UI-PLAN.md`(인체 지도 UI 기획서)의 **대·중·소 3단 분류(10계통 × 중분류 × 증상키워드)** 를
> 채택하기로 결정됨(발주처 확인). 그 외 범위 가드·스택·기능 사양은 본 문서를 따른다.
