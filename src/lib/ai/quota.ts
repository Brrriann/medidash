import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMockMode } from "@/lib/supabase/env";

/**
 * AI 생성 일일 한도 (docs/PRODUCTION-READINESS.md P0-5)
 *
 * 썸네일 배경·인물, 상품명 제안은 전부 유료 API 호출이라 무제한으로 두면 비용이 그대로
 * 청구된다. 크레딧 차감형 과금은 2차 계약 범위(docs/SPEC.md §2)이므로 여기서는
 * **일일 횟수 제한**이라는 최소 방어선만 둔다.
 *
 * 정책값은 발주처가 정할 사항이라 env로 뺐다. 미설정 시 5회.
 */
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 5);

export type QuotaResult =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; reason: string };

/** 로그인 사용자 + 관리자 여부. mock 모드는 개발·시연용이라 사용자 없음으로 본다. */
async function currentUser(): Promise<{ id: string; isAdmin: boolean } | null> {
  if (isMockMode()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, isAdmin: profile?.role === "admin" };
}

/**
 * 한도를 1회 차감한다. 넘었으면 allowed:false.
 *
 * **호출 직전에 부를 것.** 차감하고 나서 생성이 실패하면 1회가 날아가지만, 반대로
 * 생성 후에 차감하면 동시 요청이 한도를 우회한다. 비용 방어가 목적이므로 보수적으로 간다.
 *
 * 관리자는 제외한다 — 운영자가 기능 점검하다 막히면 곤란하다.
 * mock 모드(로그인 없음)도 통과시킨다. 실제 과금 대상이 아니다.
 */
export async function consumeAiQuota(): Promise<QuotaResult> {
  const user = await currentUser();
  if (!user) return { allowed: true, used: 0, limit: AI_DAILY_LIMIT };
  if (user.isAdmin) return { allowed: true, used: 0, limit: AI_DAILY_LIMIT };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_quota", {
    p_user: user.id,
    p_limit: AI_DAILY_LIMIT,
  });
  if (error) {
    // 한도 확인이 안 되면 **막는다**(fail-closed).
    // 종전엔 통과시켰는데, 이 RPC가 없는 상태(0005 마이그레이션 미실행)가 곧 "한도 영구 무효"라
    // 비용 방어선이 있으나 마나였다. 실패가 상시화되는 유일한 원인이 '설정 누락'인 이상,
    // 통과시키는 쪽은 방어가 아니라 방어가 없는 것과 같다.
    console.error("[quota] 확인 실패, 차단:", error.message);
    return {
      allowed: false,
      used: 0,
      limit: AI_DAILY_LIMIT,
      reason: "AI 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  if (data === true) return { allowed: true, used: await usedToday(user.id), limit: AI_DAILY_LIMIT };
  return {
    allowed: false,
    used: AI_DAILY_LIMIT,
    limit: AI_DAILY_LIMIT,
    reason: `오늘 AI 생성 한도(${AI_DAILY_LIMIT}회)를 다 쓰셨습니다. 내일 다시 이용해 주세요.`,
  };
}

async function usedToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("ai_quota_used", { p_user: userId });
  return typeof data === "number" ? data : 0;
}

/** 화면에 남은 횟수를 보여주기 위한 조회 (차감하지 않음). */
export async function getAiQuota(): Promise<{ used: number; limit: number; unlimited: boolean }> {
  const user = await currentUser();
  if (!user) return { used: 0, limit: AI_DAILY_LIMIT, unlimited: true };
  if (user.isAdmin) return { used: 0, limit: AI_DAILY_LIMIT, unlimited: true };
  return { used: await usedToday(user.id), limit: AI_DAILY_LIMIT, unlimited: false };
}
