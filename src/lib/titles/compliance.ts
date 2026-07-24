/**
 * 의약품 오인 표현 금지어 필터 (docs/SPEC.md §6.4 · docs/UI-PLAN.md §9)
 * 코드 레벨에서 금지어를 순화어로 치환한다. 최종 책임은 화면 고지 문구가 진다.
 */
import { BANNED_TERMS } from "@/lib/constants";

/** 금지어 → 건기식 광고 안전 순화어 (길이 긴 표현부터 치환) */
const REPLACEMENTS: Record<string, string> = {
  "면역력 강화 보장": "면역 건강",
  "질병이 낫": "건강 관리",
  "병이 낫": "건강 관리",
  치료: "케어",
  완치: "관리",
  치유: "케어",
  예방: "관리",
  약효: "기능",
  처방: "추천",
  항암: "건강",
};

// 긴 금지어를 먼저 치환하도록 정렬 (부분 겹침 방지)
const ORDERED = [...BANNED_TERMS].sort((a, b) => b.length - a.length);

/** 금지어를 순화어로 치환. changed=치환 발생 여부 */
export function sanitize(text: string): { text: string; changed: boolean } {
  let out = text;
  let changed = false;
  for (const term of ORDERED) {
    if (out.includes(term)) {
      changed = true;
      out = out.split(term).join(REPLACEMENTS[term] ?? "");
    }
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return { text: out, changed };
}

export function hasBannedTerms(text: string): boolean {
  return ORDERED.some((t) => text.includes(t));
}
