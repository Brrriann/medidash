/**
 * AI 텍스트 어댑터 (docs/SPEC.md §1·§6.4) — 상품명·태그 제안.
 *
 * `AI_TEXT_PROVIDER`(기본 openai) · `AI_TEXT_MODEL`(기본 gpt-4o-mini) · `AI_TEXT_API_KEY`.
 *
 * **AI는 후보 문자열만 낸다. 점수와 금지어 처리는 우리 코드가 한다.**
 * 노출도 등급은 네이버 실측(연관 키워드 커버리지)으로 매기고, 의약품 오인 표현은
 * `lib/titles/compliance`가 치환한다. AI에게 등급을 맡기면 근거 없는 숫자가 되고,
 * 금지어 판정을 맡기면 광고법 리스크를 모델 재량에 넘기는 꼴이 된다.
 *
 * **4-Tab 패널 초안(generatePanelDraft)은 구현하지 않는다.**
 * docs/SPEC.md §2 구현 금지 목록: "부위별 원료/기전/셀링포인트 콘텐츠 창작 —
 * 고객 제공 데이터를 적재만 한다". 상품명·태그는 셀러 자신의 상품 정보라 이 가드와 무관하다.
 */
export type Platform = "coupang" | "smartstore";
export type Exposure = "상" | "중" | "하";

export interface TitleSuggestInput {
  ingredient: string;
  bodyPart?: string;
  brand?: string;
  spec?: string;
  productHint?: string;
  platform: Platform;
  /** 네이버 상위 노출 상품이 쓰는 어휘 (타사 브랜드·제형어 제외 후) */
  relatedTerms: string[];
  /** 규칙 기반 결과 — AI가 참고할 시드 */
  seedTitles: string[];
}

export interface TextProvider {
  suggestTitlesAndTags(
    input: TitleSuggestInput,
  ): Promise<{ titles: string[]; tags: string[] }>;
}

function buildPrompt(input: TitleSuggestInput): string {
  const channel = input.platform === "coupang" ? "쿠팡" : "네이버 스마트스토어";
  const parts = [
    `대표 원료: ${input.ingredient}`,
    input.bodyPart && `부위/효능: ${input.bodyPart}`,
    input.brand && `브랜드: ${input.brand}`,
    input.spec && `규격: ${input.spec}`,
    input.productHint && `제품 특징: ${input.productHint}`,
  ].filter(Boolean);

  return [
    `${channel}에 올릴 건강기능식품 상품명 5개와 검색 태그 15개를 제안하세요.`,
    "",
    "[상품 정보]",
    ...parts,
    "",
    input.relatedTerms.length
      ? `[상위 노출 상품이 실제로 쓰는 어휘] ${input.relatedTerms.join(", ")}\n이 어휘를 최대한 활용하세요. 검색 노출에 직결됩니다.`
      : "",
    // 시드를 "참고용"으로 주면 모델이 그대로 베낀다(실측: 5안이 띄어쓰기만 다른 복사본이었다).
    // 이미 가진 안이라고 못박고 **겹치지 않는** 조합을 요구해야 값이 나온다.
    input.seedTitles.length
      ? `[이미 만든 안 — 이것과 겹치지 않게 하세요]\n${input.seedTitles.join("\n")}\n` +
        "위 안에 없는 조합을 내세요. 어순을 바꾸거나 띄어쓰기만 다른 안은 쓸모없습니다.\n" +
        "구매자가 실제로 함께 검색하는 수식어(고함량·2개월분·중장년·눈영양제 등)를 활용하세요."
      : "",
    "",
    "[반드시 지킬 것]",
    "- 상품명은 검색 키워드를 나열하는 한국 오픈마켓 방식으로. 문장형 카피 금지.",
    "- 대표 원료는 모든 상품명에 포함.",
    "- 치료·완치·예방·효과·개선 같은 의약품 오인 표현 금지.",
    "- 위에 준 브랜드 외의 타사 브랜드명 금지.",
    "- 상품명은 공백 포함 60자 이내.",
    "- 태그는 공백 없는 단어로, # 없이.",
    "",
    '결과는 JSON만 출력: {"titles":["..."],"tags":["..."]}',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

class OpenAITextProvider implements TextProvider {
  constructor(
    private key: string,
    private model: string,
  ) {}

  async suggestTitlesAndTags(
    input: TitleSuggestInput,
  ): Promise<{ titles: string[]; tags: string[] }> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "당신은 한국 오픈마켓 건강기능식품 상품명을 만드는 전문가입니다. 광고법상 의약품 오인 표현을 쓰지 않습니다. JSON만 출력합니다.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`상품명 제안 실패 (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) throw new Error("상품명 제안 응답이 비어 있습니다.");

    // 모델이 형식을 어길 수 있으므로 방어적으로 파싱한다 (실패는 호출부가 규칙 기반으로 폴백)
    const parsed = JSON.parse(raw) as { titles?: unknown; tags?: unknown };
    const strings = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
        : [];
    return { titles: strings(parsed.titles), tags: strings(parsed.tags) };
  }
}

export function getTextProvider(): TextProvider {
  const provider = process.env.AI_TEXT_PROVIDER ?? "openai";
  const key = process.env.AI_TEXT_API_KEY;
  if (!key) throw new Error("AI_TEXT_API_KEY가 없습니다. 규칙 기반 결과만 사용합니다.");
  if (provider !== "openai") {
    throw new Error(`지원하지 않는 텍스트 provider: ${provider} (현재 openai만 구현)`);
  }
  return new OpenAITextProvider(key, process.env.AI_TEXT_MODEL ?? "gpt-4o-mini");
}
