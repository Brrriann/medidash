/**
 * CS 답변 생성 — 고객 문의에 대한 답변 초안.
 *
 * **광고법이 여기서 제일 위험하다.** "이거 먹으면 관절 나아요?" 같은 문의에 AI가 그대로
 * 답하면 그 답변 자체가 광고가 된다. 건강기능식품은 질병 예방·치료 효능을 표방할 수 없다.
 * 그래서 두 겹으로 막는다 — 프롬프트에서 금지하고, 결과를 `compliance.sanitize()`에
 * 통과시킨다. 프롬프트만으로는 샌다.
 *
 * **운영 프로필이 없으면 부르지 않는다.** 배송 정책을 모르는 채로 "배송 언제 오나요"에
 * 답하면 지어낸 날짜가 나가고 그대로 클레임이 된다. 호출부가 isOpsProfileReady로 막는다.
 */
import { openaiFetch } from "./fetch";
import { sanitize } from "@/lib/titles/compliance";
import type { OpsProfile } from "@/lib/ops-profile";

export interface CsTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CsAnswer {
  text: string;
  /** 금지어가 치환됐으면 true — 화면에 안내를 띄운다 */
  sanitized: boolean;
}

function systemPrompt(p: OpsProfile): string {
  const channels = p.channels.length
    ? p.channels
        .map((c) => `- ${c.platform || "몰"}: ${c.storeName || "(스토어명 미기재)"}`)
        .join("\n")
    : "- (등록된 판매 몰 없음)";

  return [
    `당신은 "${p.brandName}"의 고객 응대 담당자입니다. ${p.category}을(를) 판매합니다.`,
    "고객 문의에 바로 복사해 보낼 수 있는 답변을 씁니다.",
    "",
    "[판매 몰]",
    channels,
    "",
    "[배송 정책]",
    p.shipping,
    "",
    p.returns ? `[교환·반품 정책]\n${p.returns}\n` : "",
    p.notes ? `[그 밖에 반영할 것]\n${p.notes}\n` : "",
    "[반드시 지킬 것]",
    "- **위에 주어진 정책 안에서만 답합니다.** 배송일·수수료·기간을 지어내지 않습니다.",
    "- 정책에 없는 내용을 물으면 모른다고 하지 말고, 확인 후 안내드리겠다고 답합니다.",
    "- 건강기능식품은 질병의 예방·치료 효과를 말할 수 없습니다. 효능 질문에는 제품의",
    "  기능성 표시 범위를 넘지 않게 답하고, 몸 상태에 대한 판단은 전문가 상담을 권합니다.",
    "- 치료·완치·예방·개선·효과·완화 같은 표현을 쓰지 않습니다.",
    "- 정중한 존댓말로, 인사 → 답변 → 마무리 순서의 완성된 문장으로 씁니다.",
    "- 답변만 출력합니다. 설명이나 머리말을 붙이지 않습니다.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export async function generateCsAnswer(
  profile: OpsProfile,
  history: CsTurn[],
): Promise<CsAnswer> {
  const key = process.env.AI_TEXT_API_KEY;
  if (!key) throw new Error("AI_TEXT_API_KEY가 없습니다.");

  const res = await openaiFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.AI_TEXT_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(profile) },
        // 대화 맥락이 필요하다 — "그럼 언제 오나요?"는 앞 문의를 알아야 답할 수 있다.
        // 다만 길면 비용이 커지므로 호출부가 최근 것만 넘긴다.
        ...history.map((t) => ({ role: t.role, content: t.content })),
      ],
      temperature: 0.4, // 정책을 옮겨 적는 일이라 창의성이 필요 없다
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CS 답변 생성 실패 (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("CS 답변이 비어 있습니다.");

  const clean = sanitize(raw);
  return { text: clean.text, sanitized: clean.changed };
}
