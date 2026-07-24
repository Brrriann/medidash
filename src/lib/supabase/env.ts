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

export function isMockMode(): boolean {
  return !supabaseConfigured();
}
