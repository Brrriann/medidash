"use server";

import { generateCsAnswer, type CsTurn } from "@/lib/ai/cs";
import { consumeAiQuota } from "@/lib/ai/quota";
import { logAi } from "@/lib/ai/log";
import { getOpsProfile } from "@/lib/data";
import { isOpsProfileReady } from "@/lib/ops-profile";
import { isMockMode } from "@/lib/supabase/env";

export type CsResult =
  | { ok: true; text: string; sanitized: boolean }
  | { ok: false; error: string };

/**
 * 대화 맥락으로 넘기는 최대 턴 수.
 *
 * "그럼 언제 오나요?"는 앞 문의를 알아야 답할 수 있어 맥락이 필요하지만, 전부 넘기면
 * 토큰이 선형으로 늘어 비용이 커진다. CS 문의는 보통 2~3턴에 끝나므로 8턴이면 넉넉하다.
 */
const MAX_TURNS = 8;

export async function askCsAction(history: CsTurn[]): Promise<CsResult> {
  if (isMockMode())
    return { ok: false, error: "mock 모드에서는 CS 답변을 만들 수 없습니다." };

  const last = history.at(-1);
  if (!last || last.role !== "user" || !last.content.trim())
    return { ok: false, error: "문의 내용을 입력해 주세요." };

  // 프로필이 없으면 정책을 지어낸 답이 나간다. 화면에서도 막지만 여기서도 막는다 —
  // 서버 액션은 화면을 거치지 않고 직접 호출될 수 있다.
  const profile = await getOpsProfile();
  if (!isOpsProfileReady(profile))
    return {
      ok: false,
      error: "운영 프로필(브랜드/상호명·배송 정책)을 먼저 설정해 주세요.",
    };

  const quota = await consumeAiQuota("text");
  if (!quota.allowed) {
    await logAi("cs_answer", false, { error: quota.reason });
    return { ok: false, error: quota.reason };
  }

  try {
    const answer = await generateCsAnswer(profile, history.slice(-MAX_TURNS));
    await logAi("cs_answer", true, {
      meta: { turns: history.length, sanitized: answer.sanitized },
    });
    return { ok: true, text: answer.text, sanitized: answer.sanitized };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[cs] 답변 생성 실패:", msg);
    await logAi("cs_answer", false, { error: msg });
    return { ok: false, error: msg };
  }
}
