/**
 * 후킹페이지 문구 생성 (상세페이지 최상단 2장).
 *
 * **AI는 문구만 낸다. 판정과 치환은 우리 코드가 한다.** 후킹 문구는 자극적일수록 잘 팔려서
 * 모델이 자연스럽게 의약품 오인 표현("통증 완화", "혈압 개선") 쪽으로 넘어간다. 프롬프트로
 * 금지해도 새므로 결과를 반드시 `lib/titles/compliance`에 통과시킨다.
 *
 * **SPEC §2 가드와의 관계**: 금지된 것은 "부위별 원료·기전·셀링포인트 콘텐츠 창작"이며,
 * 이는 증상 지도에 적재하는 시드 콘텐츠를 말한다. 여기서 만드는 것은 셀러가 파는 자기
 * 상품의 판매 문구라 상품명·태그·썸네일과 같은 성격이다 (lib/ai/text.ts에 같은 판단).
 */
import { openaiFetch } from "./fetch";
import { sanitize } from "@/lib/titles/compliance";
import type { ProductContext } from "@/lib/products/context";

/** 후킹페이지 1장 — 렌더러가 이 필드를 고정 템플릿에 꽂는다 */
export interface HookPage {
  /** 상단 작은 배지 (8자 이내) */
  badge: string;
  /** 큰 문구 — 화면의 주인공. 24자 이내라야 두 줄에 들어간다 */
  headline: string;
  /** 헤드라인 아래 보조 문구 */
  sub: string;
  /** 불릿 2~3개 */
  points: string[];
}

export interface HookResult {
  /** [0] 문제 후킹, [1] 해결 후킹 */
  pages: [HookPage, HookPage];
  /** 금지어가 치환됐으면 true — 화면에 안내를 띄운다 */
  sanitized: boolean;
}

function buildPrompt(ctx: ProductContext): string {
  const lines = [
    "건강기능식품 상세페이지 최상단에 넣을 후킹 이미지 2장의 문구를 만드세요.",
    "",
    "[상품 정보]",
    `상품명: ${ctx.spec.core || ctx.name}`,
    ctx.spec.brand && `브랜드: ${ctx.spec.brand}`,
    ctx.ingredients.length && `주요 원료: ${ctx.ingredients.join(", ")}`,
    ctx.specText && `규격: ${ctx.specText}`,
    ctx.bodyParts.length && `관련 부위: ${ctx.bodyParts.join(", ")}`,
    ctx.symptoms.length && `구매자 고민: ${ctx.symptoms.join(", ")}`,
    "",
    "[2장의 역할 — 이 순서를 지키세요]",
    "1장 (문제 후킹): 구매자가 자기 얘기라고 느끼게 고민을 지목합니다. 제품 자랑은 하지 않습니다.",
    "2장 (해결 후킹): 이 제품이 왜 그 고민에 맞는지 원료와 규격으로 보여줍니다.",
    "",
    "[반드시 지킬 것]",
    "- headline은 공백 포함 24자 이내. 길면 이미지에서 잘립니다.",
    "- badge는 8자 이내.",
    "- points는 2~3개, 각 16자 이내.",
    "- 치료·완치·예방·개선·효과·억제·완화 같은 의약품 오인 표현을 쓰지 않습니다.",
    "- 없는 수치를 만들지 않습니다. 위에 준 규격 안에서만 씁니다.",
    "- 구매자에게 말을 거는 한국어 구어체로 씁니다.",
    "",
    '결과는 JSON만: {"pages":[{"badge":"","headline":"","sub":"","points":[""]},{...}]}',
  ];
  return lines.filter(Boolean).join("\n");
}

/** 모델이 길이를 어길 수 있어 자른다. 이미지에서 잘리는 것보다 낫다. */
const cut = (s: unknown, n: number): string =>
  typeof s === "string" ? s.trim().slice(0, n) : "";

function normalize(raw: unknown): HookPage {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    badge: cut(o.badge, 10),
    headline: cut(o.headline, 30),
    sub: cut(o.sub, 40),
    points: Array.isArray(o.points)
      ? o.points.map((p) => cut(p, 20)).filter(Boolean).slice(0, 3)
      : [],
  };
}

/** 페이지 전체 문구에 금지어 치환을 건다 */
function sanitizePage(p: HookPage): { page: HookPage; changed: boolean } {
  const b = sanitize(p.badge);
  const h = sanitize(p.headline);
  const s = sanitize(p.sub);
  const pts = p.points.map((x) => sanitize(x));
  return {
    page: {
      badge: b.text,
      headline: h.text,
      sub: s.text,
      points: pts.map((x) => x.text),
    },
    changed: b.changed || h.changed || s.changed || pts.some((x) => x.changed),
  };
}

export async function generateHookCopy(ctx: ProductContext): Promise<HookResult> {
  const key = process.env.AI_TEXT_API_KEY;
  if (!key) throw new Error("AI_TEXT_API_KEY가 없습니다.");

  const res = await openaiFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.AI_TEXT_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 한국 오픈마켓 건강기능식품 상세페이지 카피라이터입니다. 광고법상 의약품 오인 표현을 쓰지 않습니다. JSON만 출력합니다.",
        },
        { role: "user", content: buildPrompt(ctx) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`후킹 문구 생성 실패 (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("후킹 문구 응답이 비어 있습니다.");

  const parsed = JSON.parse(raw) as { pages?: unknown };
  const arr = Array.isArray(parsed.pages) ? parsed.pages : [];
  if (arr.length < 2) throw new Error("후킹 문구가 2장 미만으로 왔습니다.");

  const a = sanitizePage(normalize(arr[0]));
  const b = sanitizePage(normalize(arr[1]));
  return { pages: [a.page, b.page], sanitized: a.changed || b.changed };
}
