# MediDash — Health Seller Dashboard

건강기능식품 셀러(수강생)를 위한 판매 보조 웹대시보드.
**인체 지도에서 증상 클릭 → 추천 원료·셀링포인트 확인 → 도매몰 상품 소싱 → AI 썸네일/상품명/태그 생성 → 마진 계산**까지 원스톱으로 처리합니다.

> 계약: 에어스유통 / MK-202607-C03
> 기준 문서: [`docs/SPEC.md`](docs/SPEC.md) (실행 사양서) · [`docs/UI-PLAN.md`](docs/UI-PLAN.md) (인체 지도 UI 기획서)

## 핵심 흐름

```
인체 3D 지도 (대분류 10계통 — 좌우 드래그 회전, GLB)
  → 중분류 카드 (부위/기능)
    → 증상 키워드 칩 (소분류)
      → 4-Tab 상세 패널 (특징 · 추천원료 · 기전원리 · 셀링포인트)
        → "이 원료로 상품 소싱" → 도매몰 3사 통합 검색
          → 썸네일 / 상품명·태그 / 마진 계산 프리셋
```

> 인체 모델: Higgsfield(GPT-Image-2 → Meshy image-to-3D) 생성 GLB — `public/models/body.glb`.
> 파일이 없으면 2D SVG 실루엣으로 자동 폴백됩니다. 계통 핫스팟은 `body_categories.svg_region` ↔
> `src/components/body-map/anchors.ts` 매핑으로 데이터 기반 배치.

분류 체계는 **대·중·소 3단 구조**(10계통 × 중분류 32종 × 증상 키워드)를 사용합니다 — `docs/UI-PLAN.md` §3 분류표가 시드 데이터 원본입니다.

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 프론트+백엔드 | Next.js 15 (App Router, TypeScript) |
| DB/인증/스토리지 | Supabase (PostgreSQL + Auth + Storage, RLS) |
| 스타일 | Tailwind CSS — 화이트 베이스 + 그린/블루 포인트 |
| 크롤러 | Node + Playwright 워커 (월 1회 배치) |
| AI 텍스트/이미지 | 어댑터 패턴 (`src/lib/ai/`) — 기본: Claude(텍스트) / OpenAI Images(이미지) |
| 결제 | 토스페이먼츠 (단건 결제·취소·내역) |
| 배포 | Cloudflare Pages 또는 Vercel (env 전환) |

## 시작하기

```bash
npm install
cp .env.example .env.local   # 환경변수 채우기 (아래 참고)
npm run dev                  # http://localhost:3000
```

### 환경변수

`.env.example` 참고. Supabase 키가 없으면 **mock 모드**로 동작합니다 — 로그인 없이 분류 시드 데이터 기반으로 지도/패널 UI를 둘러볼 수 있습니다(개발·시연 전용).

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용(시드·가입 코드 검증·admin) |
| `AI_TEXT_PROVIDER` / `AI_TEXT_API_KEY` | 상품명·태그·기전 텍스트 생성 |
| `AI_IMAGE_PROVIDER` / `AI_IMAGE_API_KEY` | 썸네일 배경 생성 |
| `GONYB2B_ID/PW`, `GGSAN_ID/PW`, `UPICKB2B_ID/PW` | 도매몰 크롤러 로그인 |
| `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 토스페이먼츠 |

### DB 마이그레이션 & 시드

```bash
# 1) Supabase 프로젝트의 SQL Editor에서 supabase/migrations/*.sql 순서대로 실행
#    (또는 supabase CLI: supabase db push)
# 2) 분류 체계(10계통×33중분류×증상키워드) + 샘플 원료 시드
npm run seed
# 3) 고객 제공 콘텐츠(원료/기전/셀링포인트) 적재 — 자료 수령 후
npm run seed:contents
```

### Cloudflare 배포 (Workers + OpenNext)

Next.js 15 SSR(서버 액션·미들웨어 포함)이라 **Cloudflare Workers + OpenNext 어댑터**로 배포합니다
(`wrangler.jsonc` · `open-next.config.ts` 커밋됨, `nodejs_compat` 필수).

```bash
npm run cf:build     # 어댑터 빌드 검증 (.open-next/ 생성)
npm run cf:preview   # 로컬 workerd로 프리뷰 (http://localhost:8787)
npm run cf:deploy    # 배포 — CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID 필요
```

**대시보드로 배포(권장)**: Cloudflare 대시보드 → Workers & Pages → Create → *Import a repository* →
`Brrriann/medidash` 선택 → Build command `npx opennextjs-cloudflare build`, Deploy command
`npx opennextjs-cloudflare deploy` → 배포. 환경변수를 비워두면 mock 모드로 동작하고,
Settings → Variables에 Supabase/AI 키를 넣으면 실기능이 켜집니다.

### 크롤러 운영 (월 1회)

```bash
npm run crawl            # 도매몰 3사 상품 캐시 갱신 (wholesale_products upsert)
npm run crawl:broadcast  # 홈쇼핑모아 방송 지표 갱신 (broadcast_stats upsert)
```

- 요청 간 딜레이 2~5초 랜덤, 동시성 1, 재시도 2회 — 대상 사이트 부하 최소화 필수
- 셀러 본인 계정으로만 로그인, 약관·robots 확인 후 저속·야간 실행
- admin 화면에서도 실행 버튼 및 최근 갱신일 확인 가능

## 화면 구성 (8화면)

1. **로그인/회원가입** — 이메일 + 비밀번호 + 수강생 코드(없으면 가입 불가)
2. **메인 대시보드** — 인체 인터랙티브 지도 + 최근 작업 + 빠른 메뉴
3. **4-Tab 상세 패널** — 특징 / 추천원료 / 기전원리 / 셀링포인트 + 소싱 CTA
4. **도매몰 통합 검색** — 3사 캐시 통합 카드, 도매가·추천 판매가·마진 미리보기
5. **썸네일 스튜디오** — AI 배경 생성 + 캔버스 편집(텍스트·배지·로고) + 프리셋 PNG
6. **상품명·태그 추천** — 3~5안(노출도 상/중/하) + 태그 20개, 원클릭 복사
7. **마진계산기** — 원가 자동 입력, 마진액·마진율·손익분기, 히스토리
8. **마이페이지** — 작업 이력, 계정 관리 (admin: 코드 발급·회원·크롤러 실행)

## 프로젝트 구조

```
├── docs/                  # 사양서(SPEC.md) · UI 기획서(UI-PLAN.md)
├── supabase/migrations/   # DB 스키마 + RLS
├── scripts/               # seed.ts(분류·원료) · seed-contents.ts(고객 데이터)
├── workers/               # 크롤러 (crawl-wholesale.ts · crawl-broadcast.ts · parsers/)
└── src/
    ├── app/               # App Router (auth) / (dashboard) / api
    ├── components/        # body-map(지도·패널) 등 UI 컴포넌트
    └── lib/               # supabase 클라이언트 · data 저장소 · ai 어댑터 · taxonomy
```

## 개발 로드맵

- [x] **W1 — 골격 + 지도**: 스캐폴드 · 스키마/RLS · 시드 · 인증(수강생 코드) · 인체 지도 + 4-Tab 패널
- [ ] **W2 — 데이터 파이프라인**: 도매몰 파서 3종 + 크롤러 · 홈쇼핑모아 지표 · 통합 검색 화면
- [ ] **W3 — AI + 계산기**: 상품명·태그 API(금지어 필터) · 썸네일 스튜디오 · 마진계산기(엑셀 수식 이식)
- [ ] **W4 — 결제 + 마감**: 토스 결제 · 마이페이지/admin · 실데이터 시드 · E2E · 배포

## 범위 가드 (계약 기준 — 구현하지 않는 것)

- 크레딧 차감형 과금 로직 (PG 단건 결제·취소·내역까지만)
- 도매몰·홈쇼핑모아 실시간 연동 (월 1회 배치 갱신)
- 쿠팡 Wing 자동 업로드 API (산출물은 복사/다운로드까지)
- 부위별 콘텐츠 창작 (고객 제공 데이터 적재 중심)

## 법적 고지

- 모든 AI 산출물(상품명·태그·셀링포인트·썸네일)은 **초안**입니다. 건강기능식품 표시·광고 규정(질병 예방·치료 표현 금지 등) 검수 후 사용해야 하며, 화면에 고지 문구를 노출합니다.
- 금지어(치료·완치·예방 등)는 코드 레벨 필터로 "○○에 도움을 줄 수 있음" 계열 표현으로 치환합니다.
- 크롤링은 셀러 본인 계정·저속 실행·월 1회 배치를 전제로 하며, 도매몰 이미지는 소싱 검토용 표시에 한정합니다(썸네일 배경은 AI 생성 사용).
