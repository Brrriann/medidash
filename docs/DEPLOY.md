# 배포 가이드 — Supabase + Cloudflare (브라우저만, API 토큰 불필요)

> "API 발급" 같은 어려운 절차는 없습니다. **이미 만들어진 값 3개 복사 + 레포 연결**이 전부입니다.
> 터미널 없이 대시보드에서 SQL 붙여넣기만으로 DB를 세팅합니다.

---

## A. Supabase (DB·인증) — 브라우저만

### 1. 프로젝트 생성
[supabase.com](https://supabase.com) 로그인 → **New project**
- Region: **Northeast Asia (Seoul)** 권장
- Database Password: 아무 강한 비번(메모해두기)

### 2. 스키마 만들기 (마이그레이션)
좌측 **SQL Editor** → **New query** → 레포의 [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) **전체 복사·붙여넣기** → **Run**
- "Success. No rows returned" 나오면 성공.

### 3. 분류·원료 시드
같은 **SQL Editor**에서 새 쿼리 → [`supabase/seed.sql`](../supabase/seed.sql) **전체 붙여넣기** → **Run**
- 분류 10계통·32중분류·증상·원료 샘플이 들어갑니다. 재실행해도 안전.

### 4. 운영자(admin) 계정 만들기
좌측 **Authentication → Users → Add user**
- 본인 이메일 + 비밀번호 입력, **Auto Confirm User 체크** → Create

### 5. admin 권한 + 첫 수강생 코드 (SQL 한 번)
**SQL Editor**에서 아래를 붙여넣되 `본인이메일@example.com`만 바꿔 **Run**:
```sql
insert into profiles (id, email, role)
select id, email, 'admin' from auth.users where email='본인이메일@example.com'
on conflict (id) do update set role='admin';

insert into invite_codes (code, memo, max_uses)
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

### 3. 환경변수 (A-6에서 복사한 값)
프로젝트 **Settings → Variables and Secrets** 에 추가:
| 변수 | 값 | 종류 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Text |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Text |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret(암호화)** |
| (선택) `AI_TEXT_API_KEY` 등 | AI 키 | Secret |

> 환경변수를 하나도 안 넣으면 **mock 모드**로 배포됩니다(로그인 없이 UI만). 위 3개를 넣어야 실제 로그인·저장이 켜집니다.

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
