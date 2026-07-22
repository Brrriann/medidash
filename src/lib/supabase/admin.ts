import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service role 클라이언트 (서버 전용 — RLS 우회).
 * 가입 코드 검증·회원 생성·시드 등 관리 작업에만 사용한다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
