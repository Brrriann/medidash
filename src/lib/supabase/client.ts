import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA } from "./env";

/** 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트 — medidash 스키마 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: DB_SCHEMA } },
  );
}
