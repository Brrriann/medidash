# 도매몰 크롤 — 로컬 실행 가이드 (Aside + 로컬 Claude Code)

> 이 클라우드 개발환경은 도매몰(upickb2b·ggsan·gonyb2b)이 **네트워크 차단**돼 있어 크롤을 못 합니다.
> 실제 접속·로그인이 되는 **셀러 본인 PC**에서, **Aside**(로그인된 브라우저를 읽는 MCP)로 실제 화면 구조를 확인해
> 파서 셀렉터를 채운 뒤, `npm run crawl` 로 상품을 Supabase(`medidash.wholesale_products`)에 적재합니다.
> 적재되면 배포된 대시보드의 **소싱** 화면에 실상품이 뜹니다.

크롤러 엔진(로그인→목록→상세→원료매칭→DB upsert, 매너 2~5초 딜레이·동시성 1)은 이미 완성돼 있고,
**남은 건 사이트별 실제 셀렉터 값 채우기**뿐입니다.

---

## 0. 준비물 (한 번만)

```bash
# 1) 레포 클론 (이 가이드가 있는 브랜치)
git clone -b claude/readme-repo-setup-fosajp https://github.com/Brrriann/medidash.git medidash
cd medidash

# 2) 의존성 + 크롤용 브라우저
npm install
npx playwright install chromium

# 3) 환경변수 파일 생성 — 아래 §0-1 참고
cp .env.example .env.local
#  → .env.local 을 열어 값 채우기 (이 파일은 gitignore라 커밋 안 됨)
```

### 0-1. `.env.local` 에 채울 값

```dotenv
# Supabase (크롤 결과 저장용)
NEXT_PUBLIC_SUPABASE_URL=https://rtviycvjyykejxmnykxh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   # Supabase 대시보드 → Project Settings → API → service_role secret 복사

# 도매몰 셀러 계정 (본인 계정)
UPICKB2B_ID=   # 유픽 아이디
UPICKB2B_PW=   # 유픽 비번
GGSAN_ID=      # 건강산 아이디
GGSAN_PW=      # 건강산 비번
GONYB2B_ID=    # 건온연 아이디
GONYB2B_PW=    # 건온연 비번
```

> `SUPABASE_SERVICE_ROLE_KEY` 는 비밀 키예요. `.env.local`(gitignore) 에만 두고 절대 커밋하지 마세요.

---

## 1. Aside 연결 확인

로컬 Claude Code에 Aside MCP가 붙어 있어야 합니다.

```bash
claude mcp list        # aside 가 ✓(Connected) 로 보이면 OK
```

그리고 **Aside가 제어하는 브라우저에서 도매몰 3사에 각각 로그인**해 두세요.
(Aside가 별도 브라우저 창을 열면 그 창에서 로그인. 기존 크롬을 읽으면 평소 창에서 로그인.)

---

## 2. 셀렉터 채우기 — 로컬 Claude Code에 아래 프롬프트를 붙여넣기

각 사이트당 아래 11개 값을 `workers/parsers/{upickb2b,ggsan,gonyb2b}.ts` 의 `SELECTORS` 에 채우면 됩니다.
`loginUrl / loginId / loginPw / loginSubmit / loginSuccess / listUrl / productLink / name / price / image / detail`

> ⚠️ **중요:** 셀렉터 확인엔 Aside(로그인된 브라우저)를 쓰지만, 실제 크롤(`npm run crawl`)은 **Playwright가 셀렉터+계정으로 스스로 다시 로그인**합니다. 그래서 `loginUrl`·`loginId`·`loginPw`·`loginSubmit`·`loginSuccess`(로그인 성공 시에만 나타나는 요소)를 정확히 채워야 자동 로그인이 됩니다.

```text
너는 medidash 레포의 도매몰 파서 셀렉터를 실제 사이트 기준으로 채우는 작업을 한다.
연결된 Aside MCP로 "내가 로그인해 둔 도매몰 브라우저 화면"의 실제 DOM을 읽어 확인하라.

대상 파일:
  - workers/parsers/upickb2b.ts   (유픽,   baseUrl https://upickb2b.com)
  - workers/parsers/ggsan.ts      (건강산, baseUrl https://www.ggsan.com)
  - workers/parsers/gonyb2b.ts    (건온연, baseUrl https://gonyb2b.com)
먼저 workers/parsers/shared.ts 와 위 파일들을 읽어 SiteSelectors 구조와 사용처
(loginWith / listUrlsWith / parseProductWith)를 파악하라.

사이트마다 (유픽부터 하나씩) 다음을 수행:
 1) Aside로 로그인 페이지를 열어 DOM을 읽고 실제 값을 확인:
    - loginUrl     : 로그인 페이지의 실제 URL
    - loginId      : 아이디 입력칸 CSS 셀렉터
    - loginPw      : 비밀번호 입력칸 CSS 셀렉터
    - loginSubmit  : 로그인 버튼 셀렉터
    - loginSuccess : 로그인 성공 후에만 나타나는 요소(예: 로그아웃/마이페이지 링크) 셀렉터
 2) Aside로 상품 목록 페이지를 열어:
    - listUrl      : 상품이 나열되는 목록 페이지의 실제 URL
    - productLink  : 각 상품 상세로 가는 <a> 태그 셀렉터 (반드시 href를 가진 앵커)
 3) Aside로 상품 상세 페이지 하나를 열어:
    - name  : 상품명, price : 도매가(숫자 포함 텍스트), image : 대표이미지 <img>, detail : 상세설명 컨테이너
    - 이미지가 지연로딩(lazy)이면 shared.ts가 data-src→src 순으로 읽으니 <img> 셀렉터만 맞추면 된다.
 4) 확인한 값으로 해당 파서의 SELECTORS를 수정하고, 각 줄의 // TODO 주석은 지운다.
 5) 검증: `npm run crawl -- --source=<소스> --limit=3` 실행.
    - 소스 값: 유픽=upickb2b, 건강산=ggsan, 건온연=gonyb2b
    - 출력에 상품명이 제대로 뜨고 ₩ 가격이 숫자로 나오면 성공.
    - "이름 파싱 실패" 또는 ₩? 가 뜨면 해당 셀렉터가 틀린 것 → Aside로 다시 확인해 수정하고 재실행.
    - 로그인 단계에서 실패하면 loginUrl/loginSubmit/loginSuccess 를 우선 재점검.
 6) 세 사이트 모두 --limit=3 이 성공하면 보고하라.

주의:
 - src/ 앱 코드는 건드리지 말고 workers/parsers/*.ts 의 SELECTORS 값만 수정한다.
 - 요청 간 딜레이(매너)는 그대로 두라 — 계정 차단 방지용이다.
 - 캡차/2차인증 때문에 Playwright 자동 로그인이 막히면, 그 사실을 보고하라(다른 방식 논의).
```

---

## 3. 실제 수집 실행

셋 다 `--limit=3` 검증이 되면 본수집:

```bash
# 카테고리 전체 순회 (모든 목록 페이지 — 실전 수집)
npm run crawl -- --all

# 개수 제한 (소량 확인용)
npm run crawl -- --limit=30
npm run crawl -- --source=ggsan --limit=50
```

- `--all` 은 각 사이트 카테고리의 **모든 목록 페이지를 순회**합니다(안전 상한 100페이지, 초과 시 경고 로그). 목록 페이지 사이에도 매너 딜레이가 걸립니다.
- 매너 딜레이(2~5초) 때문에 상품 수백 개면 수십 분~시간 단위 걸릴 수 있습니다. 정상입니다.
- 재실행해도 `source_url` 기준으로 중복 없이 갱신(upsert)됩니다.
- 완료 후 배포된 대시보드 **소싱** 화면에서 실상품을 확인하세요.

### 3-0. 원료 사전을 늘렸으면 재매칭 (재크롤 불필요)

`src/lib/data/sample-ingredients.ts`에 원료를 추가했다면, **이미 쌓인 상품은 예전 사전 기준 값**을 그대로 들고
있어서 검색·태그·방송배지가 안 뜹니다. 다시 크롤할 필요 없이 DB만 훑어 갱신합니다:

```bash
npm run seed            # 늘린 사전을 ingredients 테이블에 upsert
npm run rematch -- --dry  # 매칭률 before→after + 신규 매칭 표본 미리보기
npm run rematch           # 실제 반영
```

- `--dry`는 아무것도 안 바꾸고 소스별 매칭률과 신규 매칭 표본 15건만 보여줍니다. **먼저 이걸로 오탐을 눈검사하세요.**
- 멱등입니다 — 바로 다시 돌리면 "변경 0건"이 나와야 정상입니다.
- 매칭은 **상품명만** 씁니다. 상세 텍스트는 3사 모두 성분표가 아니라 판매정책 안내문이라 오탐을 만듭니다
  (실측 근거는 `workers/lib/ingredient-match.ts`의 `matchFromFields` 주석).

### 3-1. 적재 결과 확인 (리포트)
크롤 후 데이터가 제대로 들어갔는지 한 줄로 확인합니다:
```bash
npm run report
```
소스별 **건수 · 도매가 범위(평균) · 이미지 누락 · 원료매칭률 · 이상치(0원/이미지없음/미매칭) · 샘플**이 출력됩니다.
> 클라우드 개발환경은 Supabase 접근이 차단(egress 정책)돼 개발자가 직접 조회할 수 없으므로, 이 스크립트로 **로컬에서** 확인하고 결과를 공유하면 됩니다.

---

## 4. (선택) 채운 셀렉터 커밋

다음 달에도 그대로 쓰려면 셀렉터를 레포에 저장해 두면 좋습니다:

```bash
git add workers/parsers/*.ts
git commit -m "feat: 도매몰 3사 실제 셀렉터 반영"
git push
```

> `.env.local` 은 gitignore라 커밋되지 않습니다(비밀 안전).

---

## 문제 해결

| 증상 | 원인/조치 |
|---|---|
| 로그인에서 멈춤/실패 | `loginUrl` 또는 `loginSuccess` 가 틀림. 로그인 성공 후에만 보이는 요소로 `loginSuccess` 지정 |
| 상품명이 "이름 파싱 실패" | `name` 셀렉터 오류 → Aside로 상세페이지 DOM 재확인 |
| 가격이 ₩? | `price` 셀렉터가 숫자 포함 텍스트를 안 잡음 (shared.ts가 숫자만 추출하므로 "12,500원" 같은 텍스트 노드를 잡으면 됨) |
| 이미지가 비어 있음 | lazy 로딩 — `image` 를 실제 `<img>` 로 지정 (data-src 자동 대응) |
| 목록이 0건 | `productLink` 가 href 있는 `<a>` 가 아님 / `listUrl` 이 로그인 후에만 열리는 페이지인데 세션 만료 |
| 캡차·2차인증 | 자동 로그인이 막힐 수 있음 → 보고 후 대안(수집 방식 변경) 논의 |
