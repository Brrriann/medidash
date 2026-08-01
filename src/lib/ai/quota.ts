import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMockMode } from "@/lib/supabase/env";

/**
 * AI 일일 한도 (docs/PRODUCTION-READINESS.md P0-5)
 *
 * 유료 API 호출을 무제한으로 두면 비용이 그대로 청구된다. 크레딧 차감형 과금은
 * 2차 계약 범위(docs/SPEC.md §2)이므로 여기서는 **일일 횟수 제한**이라는 최소 방어선만 둔다.
 *
 * **이미지와 텍스트를 나눈 이유**: 1회 비용이 100배 차이난다.
 *   gpt-image-1  1회 ≈ 20~200원   /   gpt-4o-mini 1턴 ≈ 0.3원
 * 한 통에 담으면 CS 답변 몇 턴에 그날 썸네일을 못 만들고, 반대로 통합 한도를 올리면
 * 이미지 비용이 그만큼 배로 뛴다.
 *
 * 정책값은 발주처가 정할 사항이라 env로 뺐다.
 */
export type QuotaBucket = "image" | "text";

export const AI_LIMITS: Record<QuotaBucket, number> = {
  image: Number(process.env.AI_IMAGE_DAILY_LIMIT ?? 5),
  text: Number(process.env.AI_TEXT_DAILY_LIMIT ?? 50),
};

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

async function usedToday(userId: string, bucket: QuotaBucket): Promise<number> {
  const { data } = await createAdminClient().rpc("ai_quota_used", {
    p_user: userId,
    p_bucket: bucket,
  });
  return typeof data === "number" ? data : 0;
}

const LABEL: Record<QuotaBucket, string> = {
  image: "이미지 생성",
  text: "AI 문구 생성",
};

/**
 * 해당 통의 한도를 1회 차감한다. 넘었으면 allowed:false.
 *
 * **호출 직전에 부를 것.** 차감하고 나서 생성이 실패하면 1회가 날아가지만, 반대로
 * 생성 후에 차감하면 동시 요청이 한도를 우회한다. 비용 방어가 목적이라 보수적으로 간다.
 * (그래서 실패도 ai_logs에 남긴다 — lib/ai/log.ts 참고)
 *
 * 관리자는 제외한다 — 운영자가 기능 점검하다 막히면 곤란하다.
 * mock 모드(로그인 없음)도 통과시킨다. 실제 과금 대상이 아니다.
 */
export async function consumeAiQuota(bucket: QuotaBucket): Promise<QuotaResult> {
  const limit = AI_LIMITS[bucket];
  const user = await currentUser();
  if (!user || user.isAdmin) return { allowed: true, used: 0, limit };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_quota", {
    p_user: user.id,
    p_bucket: bucket,
    p_limit: limit,
  });
  if (error) {
    // 한도 확인이 안 되면 막지 않는다 — 조회 실패로 전원이 못 쓰게 되는 쪽이 더 나쁘다.
    console.warn("[quota] 확인 실패, 통과시킴:", error.message);
    return { allowed: true, used: 0, limit };
  }
  if (data === true)
    return { allowed: true, used: await usedToday(user.id, bucket), limit };

  return {
    allowed: false,
    used: limit,
    limit,
    reason: `오늘 ${LABEL[bucket]} 한도(${limit}회)를 다 쓰셨습니다. 내일 다시 이용해 주세요.`,
  };
}

export interface AiQuotaView {
  image: { used: number; limit: number };
  text: { used: number; limit: number };
  /** 관리자·mock 모드는 한도가 적용되지 않는다 */
  unlimited: boolean;
}

/** 화면에 남은 횟수를 보여주기 위한 조회 (차감하지 않음). */
export async function getAiQuota(): Promise<AiQuotaView> {
  const blank = {
    image: { used: 0, limit: AI_LIMITS.image },
    text: { used: 0, limit: AI_LIMITS.text },
  };
  const user = await currentUser();
  if (!user || user.isAdmin) return { ...blank, unlimited: true };

  const [image, text] = await Promise.all([
    usedToday(user.id, "image"),
    usedToday(user.id, "text"),
  ]);
  return {
    image: { used: image, limit: AI_LIMITS.image },
    text: { used: text, limit: AI_LIMITS.text },
    unlimited: false,
  };
}
