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
