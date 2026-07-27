/**
 * MediDash 전용 Postgres 스키마. 기존 Supabase 프로젝트와 테이블 충돌을 피하기 위해
 * 모든 테이블을 이 스키마에 두고, supabase-js 클라이언트도 이 스키마를 조회한다.
 * (대시보드 Exposed schemas에도 등록 필요 — docs/DEPLOY.md)
 */
export const DB_SCHEMA = "medidash";

/**
 * Supabase 설정 여부. 키가 없으면 mock 모드 —
 * 로그인 없이 시드 데이터(src/lib/taxonomy, src/lib/data)로 UI를 렌더한다 (개발/시연 전용).
 */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * mock 모드 여부. **프로덕션에서는 mock으로 떨어지지 않고 즉시 실패한다.**
 *
 * 종전엔 키가 없으면 프로덕션에서도 조용히 mock이 됐다. 그러면 미들웨어가 모든 요청을
 * 통과시키고(src/middleware.ts) AI 라우트도 인증을 건너뛴다 — 즉 **설정 실수 하나가
 * 사이트 전체 공개 + 유료 API 무료 개방**이 된다. 게다가 증상이 "로그인 화면이 안 뜬다"
 * 정도라 눈치채기 어렵다. `.env.production`을 빌드에 싣는 배포 방식(docs/DEPLOY.md B-3)이라
 * 값이 비거나 덮어써지는 실수가 실제로 일어난다.
 *
 * 그래서 프로덕션 미설정은 던진다. 빌드 중이면 빌드가 깨지고(= 잘못된 배포가 나가지 않고),
 * 런타임이면 미들웨어가 503을 준다. 조용한 성공보다 시끄러운 실패가 낫다.
 */
export function isMockMode(): boolean {
  if (supabaseConfigured()) return false;
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 없습니다. " +
        "프로덕션은 mock 모드로 뜨지 않습니다 — .env.production 값을 확인하세요 (docs/DEPLOY.md B-3).",
    );
  return true;
}
