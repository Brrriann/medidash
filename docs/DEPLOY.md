# 배포 가이드 — Supabase + Cloudflare (브라우저만, API 토큰 불필요)

> "API 발급" 같은 어려운 절차는 없습니다. **이미 만들어진 값 3개 복사 + 레포 연결**이 전부입니다.
> 터미널 없이 대시보드에서 SQL 붙여넣기만으로 DB를 세팅합니다.
>
> **이 프로젝트는 기존 Supabase에 `medidash` 전용 스키마로 격리 설치**됩니다(기존 앱과 테이블 충돌 없음).
> 그래서 아래 **A-2(스키마 노출) 단계가 반드시 필요**합니다. `auth`(로그인 계정)는 프로젝트 공용입니다.

---

## A. Supabase (DB·인증) — 브라우저만

### 1. 프로젝트 (기존 것 사용)
기존 Supabase 프로젝트를 그대로 씁니다. (새로 만들 거면 [supabase.com](https://supabase.com) → New project, Region **Seoul** 권장)

### 2. 스키마 만들기 (마이그레이션) + 스키마 노출
좌측 **SQL Editor** → **New query** → 레포의 [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) **전체 복사·붙여넣기** → **Run**
- `medidash` 스키마와 테이블·RLS·권한이 한 번에 생성됩니다. "Success" 나오면 성공.

**중요 — 스키마 노출**: **Project Settings → API → Data API → Exposed schemas** 에서
`medidash` 를 추가(체크)하고 저장하세요. (기본은 `public`만 노출 → 이걸 안 하면 앱이 데이터에 접근 못 합니다.)

### 3. 분류·원료 시드
같은 **SQL Editor**에서 새 쿼리 → [`supabase/seed.sql`](../supabase/seed.sql) **전체 붙여넣기** → **Run**
- 분류 10계통·32중분류·증상·원료 샘플이 들어갑니다. 재실행해도 안전.

### 4. 운영자(admin) 계정 만들기
좌측 **Authentication → Users → Add user**
- 본인 이메일 + 비밀번호 입력, **Auto Confirm User 체크** → Create

### 5. admin 권한 + 첫 수강생 코드 (SQL 한 번)
**SQL Editor**에서 아래를 붙여넣되 `본인이메일@example.com`만 바꿔 **Run** (medidash 스키마):
```sql
insert into medidash.profiles (id, email, role)
select id, email, 'admin' from auth.users where email='본인이메일@example.com'
on conflict (id) do update set role='admin';

insert into medidash.invite_codes (code, memo, max_uses)
values ('MEDI-2026-CLASS', '초기 수강생 코드', 100)
on conflict (code) do nothing;
```

### 6. 키 3개 복사 (여기가 "API")
좌측 **Project Settings → API** 에서 3개 값을 복사해 둡니다 — 발급이 아니라 **이미 있는 값 복사**입니다:
| Supabase 화면 표기 | 넣을 환경변수 |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Project API keys → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` |

---

## B. Cloudflare 배포 — 브라우저만 (API 토큰 불필요)

### 1. 레포 연결
[dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Import a repository**
- GitHub 연결(최초 1회 OAuth) → **`Brrriann/medidash`** 선택
- Branch: `main` (PR #1 머지 후) 또는 `claude/readme-repo-setup-fosajp`

### 2. 빌드 설정 (두 칸만)
- **Build command**: `npx opennextjs-cloudflare build`
- **Deploy command**: `npx opennextjs-cloudflare deploy`

### 3. 환경변수

**공개 값 2개(URL·anon 키)는 이미 레포 [`.env.production`](../.env.production)에 커밋**되어 **빌드에 자동 포함**됩니다 — Cloudflare에 따로 안 넣어도 됩니다.
> 이유: `NEXT_PUBLIC_*` 값은 런타임이 아니라 **빌드 시점**에 코드에 박힙니다. Cloudflare **런타임** 변수에만 넣으면 빌드가 못 읽어 **mock 모드**로 떠요. 그래서 빌드에 확실히 들어가도록 파일로 커밋합니다.
>
> ⚠️ **혹시 Cloudflare에 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를 이미 넣었다면 삭제하세요.** 빌드 변수로 잘못(빈 값 등) 들어가 있으면 `.env.production` 값을 덮어써서 계속 mock 모드가 됩니다.

**비밀 키 1개만** 프로젝트 **Settings → Variables and Secrets** 에 **Secret(런타임)** 으로 추가:
| 변수 | 값 | 종류 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (A-6) | **Secret(암호화)** |
| (선택) `AI_TEXT_API_KEY` 등 | AI 키 | Secret |

> Supabase 프로젝트를 바꾸면 `.env.production`의 두 값을 수정해 다시 배포하세요. (`.env.production`을 지우면 mock 모드로 돌아갑니다.)

### 4. 배포 & 확인
**Deploy** → 완료되면 `https://medidash.<계정>.workers.dev` 발급.
- 그 URL 접속 → **A-4에서 만든 이메일로 로그인** → 관리자 화면 확인
- 수강생에겐 **`MEDI-2026-CLASS`** 코드로 회원가입 안내

### 5. (권장) 로그인 리다이렉트 URL
Supabase **Authentication → URL Configuration → Site URL** 에 배포 URL 추가.

---

## 참고

- **무료 티어 주의**: Supabase 무료 프로젝트는 1주 미사용 시 자동 일시정지됩니다. 실서비스는 Pro 권장 — [`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) 참고.
- **터미널을 쓰는 경우**(대안): 로컬 `.env.local`에 3개 키를 넣고
  ```bash
  npm run seed                                   # 분류·원료 시드
  npm run bootstrap:admin -- --email=you@x.com --password='비번8자+'   # admin + 수강생 코드
  npm run cf:deploy                              # CLI 배포 (CLOUDFLARE_API_TOKEN 필요)
  ```
- **시드 SQL 재생성**: `npx tsx scripts/gen-seed-sql.ts > supabase/seed.sql`
