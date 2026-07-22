"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";

export interface AdminActionState {
  ok: boolean;
  error: string | null;
  createdCode?: string;
}

const MOCK_ERROR = "Mock 모드에서는 사용할 수 없습니다 (Supabase 미연결).";

/** admin 역할 확인 후 supabase 클라이언트 반환 (RLS is_admin 정책과 이중 방어) */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "로그인이 필요합니다." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return { supabase: null, error: "admin 권한이 필요합니다." };
  return { supabase, error: null };
}

/** 수강생 코드 발급 — MEDI-XXXX-XXXX */
export async function createInviteCode(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (isMockMode()) return { ok: false, error: MOCK_ERROR };

  const { supabase, error: authError } = await requireAdmin();
  if (!supabase) return { ok: false, error: authError };

  const memo = String(formData.get("memo") ?? "").trim() || null;
  const maxUses = Math.max(1, Number(formData.get("maxUses")) || 1);
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;

  const code = `MEDI-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;

  const { error } = await supabase.from("invite_codes").insert({
    code,
    memo,
    max_uses: maxUses,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: `발급 실패: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true, error: null, createdCode: code };
}

/** 코드 삭제 (미사용 코드 정리용) */
export async function deleteInviteCode(formData: FormData): Promise<void> {
  if (isMockMode()) return;
  const { supabase } = await requireAdmin();
  if (!supabase) return;

  const code = String(formData.get("code") ?? "");
  if (!code) return;
  await supabase.from("invite_codes").delete().eq("code", code);
  revalidatePath("/admin");
}
