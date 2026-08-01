# 작업지시서 — 카카오·구글 소셜 로그인 활성화

**대상**: 브라우저 자동화 에이전트
**소요**: 30~40분
**결과물**: `health-seller.com` 로그인 화면의 카카오·구글 버튼이 실제로 동작

---

## 0. 이 작업의 전체 그림

로그인 버튼은 코드에 이미 있다(PR #28). 지금 없는 것은 **제공자 3곳의 연결 설정**뿐이다.

```
사용자 → [카카오/구글 동의화면] → Supabase → health-seller.com/auth/callback → /onboarding
          ①콘솔에서 앱 생성        ②Supabase에      ③Supabase URL
          + 콜백 등록              키 입력           Configuration
```

세 군데가 **서로 다른 URL 두 개**를 주고받는다. 이걸 헷갈리면 전부 실패한다.

| 이름 | 값 | 어디에 넣나 |
|---|---|---|
| **URL-A** (제공자 → Supabase) | `https://rtviycvjyykejxmnykxh.supabase.co/auth/v1/callback` | 구글 콘솔, 카카오 콘솔 |
| **URL-B** (Supabase → 우리 사이트) | `https://health-seller.com/auth/callback`<br>`http://localhost:3000/auth/callback` | Supabase URL Configuration |

URL-A를 Supabase에 넣거나 URL-B를 구글 콘솔에 넣으면 안 된다.

---

## 1. 에이전트가 하지 않는 일 (사람에게 넘길 것)

아래에 해당하면 **작업을 멈추고 사람을 호출한다.** 진행하지 말 것.

1. **로그인** — 카카오계정·구글계정·Supabase 로그인 화면이 뜨면 멈춘다. 아이디·비밀번호를 입력하지 않는다.
2. **Secret / Key 값 입력** — `Client Secret`, `REST API 키`, `보안 비밀번호` 등 **키·시크릿으로 불리는 값은 읽지도, 옮겨 적지도, 붙여넣지도 않는다.** 해당 칸에 도달하면 사람을 부른다.
3. **약관·동의 화면** — 새 약관 동의, 결제수단 등록, 개인정보 제3자 제공 동의가 뜨면 멈춘다.
4. **계정·조직 생성** — 새 카카오/구글/Supabase 계정이나 결제 조직을 만들지 않는다. (콘솔 안에서 **애플리케이션**을 만드는 것은 해도 된다.)
5. **삭제·비활성화** — 기존 앱·키·설정을 지우거나 끄지 않는다. 이 작업은 **추가만** 한다.

시크릿을 대화창·로그·스크린샷 캡션에 남기지 않는다. 화면에 노출된 상태로 스크린샷을 찍지 않는다(가려진 상태에서 `Reveal`을 누르지 말 것).

---

## 2. 사전 확인

시작 전 아래 3개 탭이 **로그인된 상태**인지 확인한다. 하나라도 로그인 화면이면 사람을 부른다.

| # | URL | 확인 방법 |
|---|---|---|
| 1 | https://supabase.com/dashboard/project/rtviycvjyykejxmnykxh/auth/providers | `Auth Providers` 목록이 보이면 OK |
| 2 | https://console.cloud.google.com/apis/credentials | `사용자 인증 정보` 화면이 보이면 OK |
| 3 | https://developers.kakao.com/console/app | `내 애플리케이션` 목록이 보이면 OK |

---

## PHASE 1 — 구글

### 1-1. OAuth 클라이언트 생성

접속: `https://console.cloud.google.com/apis/credentials`

1. 상단 프로젝트 선택기에서 사용할 프로젝트를 고른다. 없으면 **사람 호출**(프로젝트 생성은 결제·조직과 엮인다).
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. "동의 화면을 먼저 구성하라"는 안내가 나오면 → **1-2로 이동** 후 돌아온다.
4. 애플리케이션 유형: **웹 애플리케이션**
5. 이름: `health-seller`
6. **승인된 자바스크립트 원본** → `URI 추가`:
   ```
   https://health-seller.com
   ```
7. **승인된 리디렉션 URI** → `URI 추가` — 여기에 **URL-A**를 넣는다:
   ```
   https://rtviycvjyykejxmnykxh.supabase.co/auth/v1/callback
   ```
8. **만들기**
9. 팝업에 **클라이언트 ID**와 **클라이언트 보안 비밀번호**가 뜬다.
   → **여기서 멈추고 사람을 호출한다.** 이 창을 닫지 말 것. 사람이 값을 Supabase에 직접 옮긴다(PHASE 3).

### 1-2. (필요 시) OAuth 동의 화면

`API 및 서비스` → `OAuth 동의 화면`

- User Type: **외부**
- 앱 이름: `헬스셀러`, 지원 이메일·개발자 연락처: 사람에게 물어본다
- 범위(Scopes): `userinfo.email`, `userinfo.profile` 추가
- 게시 상태가 **테스트**면 테스트 사용자에 등록된 계정만 로그인된다. 수강생에게 열려면 **프로덕션으로 게시** 필요 — 이건 **사람이 결정**한다. 임의로 게시하지 말 것.

### 1-3. 확인
- `사용자 인증 정보` 목록에 `health-seller` 항목이 **OAuth 2.0 클라이언트 ID** 유형으로 보인다.
- 그 항목을 열면 리디렉션 URI에 URL-A가 정확히 들어가 있다(오타·끝 슬래시 주의).

---

## PHASE 2 — 카카오

### 2-1. 애플리케이션 생성

접속: `https://developers.kakao.com/console/app`

1. **애플리케이션 추가하기**
2. 앱 이름 `헬스셀러`, 회사명은 사람에게 물어본다. 저장.

### 2-2. 앱 키 확인
`앱 설정` → `앱 키` 에서 **REST API 키**가 카카오의 Client ID다.
→ **값을 읽지 말고**, 이 화면 위치만 기억해 둔다. PHASE 3에서 사람이 옮긴다.

### 2-3. 카카오 로그인 활성화
`제품 설정` → `카카오 로그인`

1. **활성화 설정** 스위치를 **ON**
2. **Redirect URI** → `Redirect URI 등록` — **URL-A**를 넣는다:
   ```
   https://rtviycvjyykejxmnykxh.supabase.co/auth/v1/callback
   ```
3. 저장

### 2-4. Client Secret ⚠️ 가장 자주 틀리는 곳
`제품 설정` → `카카오 로그인` → `보안`

1. **Client Secret** → `코드 생성`
2. **활성화 상태를 `사용함`으로 바꾸고 저장** ← **생성만 하고 이 스위치를 안 켜면 Supabase가 거부한다.**
3. 값 자체는 **읽지 말고** 사람을 호출한다.

### 2-5. 동의항목
`제품 설정` → `카카오 로그인` → `동의항목`

| 항목 | 설정 |
|---|---|
| 닉네임 | 필수 동의 |
| 카카오계정(이메일) | 필수 동의 |

- 이메일이 **필수 동의**가 아니면 Supabase가 사용자를 못 만든다.
- "비즈 앱 전환이 필요하다"는 안내가 뜨면 → **사람 호출.** 비즈 앱 전환은 사업자 정보가 필요하다.

### 2-6. 플랫폼 등록
`앱 설정` → `플랫폼` → `Web 플랫폼 등록` → 사이트 도메인:
```
https://health-seller.com
```

### 2-7. 확인
- 카카오 로그인 활성화 = ON
- Redirect URI 목록에 URL-A 존재
- Client Secret 활성화 상태 = **사용함**
- 동의항목: 닉네임·이메일 = 필수 동의

---

## PHASE 3 — Supabase에 키 입력 (사람이 값 입력)

접속: `https://supabase.com/dashboard/project/rtviycvjyykejxmnykxh/auth/providers`

에이전트는 **화면을 열고 스크롤·클릭까지만** 한다. 값 입력은 사람이 한다.

### 3-1. Google
1. `Auth Providers` 목록에서 **Google** 클릭 (우측 패널이 열린다)
2. **Enable Sign in with Google** → ON
3. `Client IDs` ← PHASE 1-1의 **클라이언트 ID** (사람)
4. `Client Secret (for OAuth)` ← PHASE 1-1의 **보안 비밀번호** (사람)
5. `Callback URL (for OAuth)` 칸에 URL-A가 이미 채워져 있는지 확인만 한다 — **수정 금지**
6. **Save**

### 3-2. Kakao
1. 목록에서 **Kakao** 클릭
2. **Enable Sign in with Kakao** → ON
3. `Kakao Client ID` ← PHASE 2-2의 **REST API 키** (사람)
4. `Kakao Client Secret` ← PHASE 2-4의 **Client Secret** (사람)
5. **Save**

### 3-3. 확인
목록으로 돌아가 **Google·Kakao 모두 `Enabled`** 배지인지 본다.

---

## PHASE 4 — Redirect URLs (URL-B)

접속: `https://supabase.com/dashboard/project/rtviycvjyykejxmnykxh/auth/url-configuration`

1. **Site URL** = `https://health-seller.com`
2. **Redirect URLs** → `Add URL` 로 **두 개** 추가:
   ```
   https://health-seller.com/auth/callback
   http://localhost:3000/auth/callback
   ```
3. 저장

> 이 단계를 빠뜨리면 **동의까지 다 끝난 뒤 마지막에 튕긴다.** 증상이 앞 단계와 달라 원인을 찾기 어렵다.

---

## PHASE 5 — 검증

PR #28이 머지·배포된 뒤 수행한다. 아직이면 여기서 멈추고 보고한다.

1. `https://health-seller.com/login` 접속
2. **Google로 계속하기** 클릭 → 구글 동의 화면 → 동의
3. `https://health-seller.com/onboarding` 으로 이동하고 **"수강생 코드 확인"** 화면이 보이면 **성공**
4. 뒤로 가서 **카카오로 계속하기**도 같은 방식으로 확인

> `/onboarding` 이 뜨는 것이 정상이다. 이 서비스는 수강생 전용이라 소셜 로그인만으로 대시보드가 열리지 않는다. 코드 입력은 **사람이** 한다.

---

## 증상별 원인표

| 증상 | 원인 | 고칠 곳 |
|---|---|---|
| 버튼 클릭 시 `Unsupported provider` | Supabase에서 해당 제공자 비활성 | PHASE 3 |
| 구글 `redirect_uri_mismatch` | 승인된 리디렉션 URI 불일치 | PHASE 1-1 (URL-A 오타·끝 슬래시) |
| 카카오 `KOE006` | Redirect URI 미등록 | PHASE 2-3 |
| 카카오 `KOE010` / invalid client | **Client Secret 활성화 안 됨** | PHASE 2-4 |
| 동의 후 이메일 없음 오류 | 이메일 동의항목이 선택 동의 | PHASE 2-5 |
| 동의까지 됐는데 마지막에 로그인 화면으로 되돌아감 | Redirect URLs 미등록 | PHASE 4 |
| 구글에서 "앱이 확인되지 않음" / 테스트 사용자만 가능 | 동의 화면이 테스트 상태 | PHASE 1-2 (사람 결정) |

---

## 보고 형식

작업 종료 시 아래를 보고한다. **키·시크릿 값은 절대 포함하지 않는다.**

```
PHASE 1 구글   : 완료 / 중단(사유)
PHASE 2 카카오 : 완료 / 중단(사유)
PHASE 3 Supabase 제공자 : Google=Enabled/Disabled, Kakao=Enabled/Disabled
PHASE 4 Redirect URLs   : 등록된 URL 목록
PHASE 5 검증   : 구글=성공/실패, 카카오=성공/실패 (실패 시 화면에 뜬 오류 코드 원문)
사람 호출이 필요했던 지점:
```

---

## 참고

- 네이버는 이 작업 범위가 아니다. Supabase 기본 제공자가 아니라 별도 검토가 필요하다 — [`DEPLOY.md`](DEPLOY.md) C절 참고.
- 코드 쪽 설명은 [`DEPLOY.md`](DEPLOY.md) C절, 관문 설계는 PR #28 본문 참고.
