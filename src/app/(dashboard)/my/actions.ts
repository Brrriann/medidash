"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { toOpsProfile, type OpsProfile } from "@/lib/ops-profile";

export interface OpsProfileState {
  error: string | null;
  saved: boolean;
}

/**
 * 운영 프로필 저장.
 *
 * `profiles`는 본인 행만 update하도록 RLS가 걸려 있으므로 service role이 필요 없다 —
 * 사용자 클라이언트로 쓰면 남의 프로필을 건드릴 수 없는 것이 DB에서 보장된다.
 *
 * 채널은 개수가 정해져 있지 않아 `channel-<i>-<필드>` 형태로 받아 인덱스별로 묶는다.
 * 폼에서 행을 지우면 인덱스가 비므로 순번이 아니라 존재하는 것만 모은다.
 */
export async function saveOpsProfileAction(
  _prev: OpsProfileState,
  formData: FormData,
): Promise<OpsProfileState> {
  if (isMockMode())
    return { error: "mock 모드에서는 저장할 수 없습니다.", saved: false };

  const channels: OpsProfile["channels"] = [];
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^channel-(\d+)-platform$/);
    if (!m) continue;
    const i = m[1];
    const platform = String(value ?? "").trim();
    const storeName = String(formData.get(`channel-${i}-storeName`) ?? "").trim();
    const url = String(formData.get(`channel-${i}-url`) ?? "").trim();
    if (platform || storeName) channels.push({ platform, storeName, url });
  }

  const profile = toOpsProfile({
    brandName: formData.get("brandName"),
    category: formData.get("category"),
    channels,
    shipping: formData.get("shipping"),
    returns: formData.get("returns"),
    notes: formData.get("notes"),
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다.", saved: false };

    const { error } = await supabase
      .from("profiles")
      .update({ ops_profile: profile })
      .eq("id", user.id);
    if (error) return { error: `저장에 실패했습니다: ${error.message}`, saved: false };

    // CS 화면이 이 프로필로 입력 잠금을 판단하므로 함께 갱신한다.
    revalidatePath("/my");
    revalidatePath("/cs");
    return { error: null, saved: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.",
      saved: false,
    };
  }
}
