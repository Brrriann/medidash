# MediDash 코드 리뷰

검토일: 2026-07-27
범위: 현재 `main` 스냅샷의 구조, 로직, 보안, 배포·운영성. 코드 수정 없이 읽기 및 안전한 실행 검증만 수행했다.

## 결론

현재 상태는 **mock 데모/테스트 버전으로는 동작**하지만, **정식 운영 배포 승인 상태는 아니다**. 최우선으로 인증 설정 실패 시의 공개 접근, AI 비용 한도 우회, 배포 마이그레이션 불일치를 해소해야 한다.

## 우선 수정 사항

### 높음: Supabase 설정 누락이 인증 해제로 이어짐

`NEXT_PUBLIC_SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 앱 전체가 mock 모드가 된다. 미들웨어가 모든 요청을 통과시키고, AI 이미지 API도 인증 없이 처리한다. AI 키만 남은 잘못된 배포에서는 외부인이 유료 AI를 호출할 수 있다.

- 근거: `src/lib/supabase/env.ts:12-20`
- 근거: `src/middleware.ts:10-14`
- 근거: `src/app/api/ai/image/route.ts:27-35`

### 높음: AI 일일 한도가 장애 시 우회됨

한도 RPC가 실패하면 현재 구현은 로그만 남기고 `allowed: true`를 반환한다. DB 장애, 권한 오류, 마이그레이션 누락이 발생하면 비용 방어가 사라진다.

- 근거: `src/lib/ai/quota.ts:51-60`
- 영향 경로: `src/app/api/ai/image/route.ts:44-46`, `src/app/(dashboard)/titles/actions.ts:69-78`

### 높음: 문서대로 신규 배포하면 초대코드 가입이 실패함

배포 문서는 초기 마이그레이션 `0001`만 실행하도록 안내하지만, 가입은 `0004_claim_invite_code.sql`에 있는 RPC를 필수로 호출한다. AI 한도도 `0005`에 의존한다.

- 근거: `docs/DEPLOY.md:16-25`
- 근거: `src/app/(auth)/actions.ts:50-57`
- 근거: `supabase/migrations/0004_claim_invite_code.sql:10-50`
- 근거: `supabase/migrations/0005_ai_daily_quota.sql:29-68`

### 높음: 명세와 실제 완료 범위가 다름

결제·취소·결제내역은 명세의 인수 기준에 있으나 구현되어 있지 않다. 관리자 화면의 크롤러 실행 버튼도 비활성 플레이스홀더다. 테스트 빌드라는 현재 상태를 전제로 한다면 기능 누락 자체보다 README·명세와 UI의 완료 표기를 일치시키는 일이 필요하다.

- 근거: `docs/SPEC.md:227`
- 근거: `src/app/(dashboard)/my/page.tsx:91-93`
- 근거: `src/app/(dashboard)/admin/page.tsx:183-213`

### 높음: 프로덕션 의존성 취약점

`npm audit --omit=dev`에서 high 3건이 확인됐다. 직접 의존성인 Next 경로로 PostCSS와 sharp 취약점이 포함된다. 배포 전 잠금 파일 기준의 업데이트와 재감사가 필요하다.

## 중간 우선순위 사항

### 크롤러의 부분 실패가 정상 갱신처럼 보일 수 있음

소스·항목 실패를 흡수하고 부분 결과를 upsert한 뒤 정상 종료할 수 있다. 데이터의 완전성·신선도 상태나 실패 알림도 없다.

- 근거: `workers/crawl-wholesale.ts:65-110`
- 근거: `workers/crawl-broadcast.ts:145-160`
- 근거: `workers/lib/manners.ts:47-61`

### 서버 액션 입력 검증 부족

마진 저장은 클라이언트가 보낸 객체를 재계산하지만 값 범위와 플랫폼 값을 검증하지 않는다. 관리자 초대코드 발급도 잘못된 날짜 문자열에서 예외가 날 수 있다. 브라우저 `min` 속성은 서버 경계 보호가 아니다.

- 근거: `src/app/(dashboard)/margin/actions.ts:14-35`
- 근거: `src/lib/margin.ts:59-92`
- 근거: `src/app/(dashboard)/admin/actions.ts:43-46`

### 썸네일 작업이 실제 산출물을 보관하지 않음

작업 이력에는 레이아웃 메타데이터만 저장되고 실제 이미지 파일은 저장되지 않는다. 명세의 Storage 보관 요구와 다르다.

- 근거: `src/app/(dashboard)/studio/actions.ts:62-85`

### 테스트·CI·운영 관측 부족

현재 테스트는 계산, 원료 매칭, 제목 생성 같은 순수 로직 49건을 다룬다. 인증, RLS, 가입 RPC, AI 한도, 크롤러 실패, 실제 배포 흐름은 검증되지 않는다. GitHub Actions 등 CI도 없다.

- 근거: `package.json:11`
- 근거: `docs/PRODUCTION-READINESS.md:30-42`

### 빌드 재현성 확인 필요

검토 중 `.next` 산출물을 동시에 사용하는 프로세스 때문에 빌드 실패 사례가 있었고, 정리 뒤의 QA 빌드는 통과했다. CI에서 깨끗한 환경의 단일 직렬 `npm ci && npm run build`를 필수 게이트로 고정해야 한다.

## 구조·품질 관찰

- `src/lib/data/index.ts`는 taxonomy, 작업 이력, 마진, 소싱, 방송, 키워드, 관리자 데이터를 함께 담당한다. 현재 규모에서는 동작하지만 변경 영향 범위가 넓어졌다.
- `ThumbnailStudio.tsx`는 700줄 이상으로 UI 상태와 캔버스 동작을 함께 가진다. 다음 기능 추가 전 책임 분리를 검토할 시점이다.
- README, 배포 문서, 운영 준비 문서 사이에 마이그레이션 실행 범위와 완료 상태가 일관되지 않다.

## 확인된 강점

- RLS 정책과 사용자별 작업물·마진 데이터 격리가 설계되어 있다.
- 초대코드 사용량 증가와 AI 쿼터 증가는 DB RPC로 원자 처리한다.
- `security definer` 함수의 `search_path`를 고정했다.
- OpenAI Durable Object 프록시는 대상 URL을 허용 목록으로 제한해 SSRF 통로를 방지한다.
- 계산·원료 매칭·상품명 생성 테스트는 구현 상수를 복제하지 않고 실제 행위를 검증한다.

## 검증 결과와 한계

- `npm test`: 49/49 통과
- `npm run lint`: 통과
- `npx tsc --noEmit`: 통과
- mock 모드 수동 QA: 주요 페이지, 인체 지도 상세 흐름, 소싱 필터, AI API의 잘못된 JSON(400) 및 AI 키 미설정 응답(502)을 확인
- 실제 Supabase/RLS, AI 공급자, 크롤러 대상 사이트, Cloudflare 배포는 자격증명·운영 환경 부재로 검증하지 못함

## 권장 처리 순서

1. 설정 누락 시 mock 모드가 아닌 배포 실패로 처리하고 AI API 인증을 독립적으로 강제한다.
2. AI 쿼터는 비용 발생 경로에서 fail-closed로 전환하고 환경값을 검증한다.
3. 배포 문서를 전체 마이그레이션 실행 절차와 일치시킨다.
4. 의존성 취약점을 해소하고 깨끗한 환경의 CI 빌드·테스트·감사 게이트를 만든다.
5. 결제, 크롤러 실행·상태 추적, Storage 보관의 범위를 제품 일정에 맞춰 명시하거나 구현한다.
