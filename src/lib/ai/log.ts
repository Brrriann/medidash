import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";

/**
 * AI 호출 이력 (medidash.ai_logs)
 *
 * **성공만 남기면 안 된다.** 할당량은 유료 호출 **직전**에 차감하므로(lib/ai/quota.ts),
 * 생성이 실패해도 1회가 빠진다. 성공만 기록하면 "왜 3회밖에 안 남았지?"에 답할 수 없고
 * 그대로 문의가 된다. 운영 중 어떤 요청이 깨지는지 보려면 실패 쪽이 오히려 더 중요하다.
 *
 * 기록은 **service role로만** 쓴다 — ai_logs에 insert 정책을 두지 않아 클라이언트가
 * 이력을 위조하거나 지울 수 없다.
 *
 * 기록 실패가 본 작업을 막으면 안 된다. 이력은 부가 기능이고 이미지 생성이 본 작업이다.
 */
export type AiKind =
  | "thumbnail_bg"
  | "person_cutout"
  | "hook_copy"
  | "hook_bg"
  | "title_tags";

export async function logAi(
  kind: AiKind,
  ok: boolean,
  opts: { error?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  if (isMockMode()) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await createAdminClient()
      .from("ai_logs")
      .insert({
        user_id: user.id,
        kind,
        ok,
        // 사용자에게 그대로 보이는 문구라 길이를 자른다. 원문 전체는 서버 로그에 남는다.
        error: opts.error ? opts.error.slice(0, 200) : null,
        meta: opts.meta ?? {},
      });
  } catch (e) {
    console.warn("[ai_logs] 기록 실패:", e instanceof Error ? e.message : e);
  }
}
