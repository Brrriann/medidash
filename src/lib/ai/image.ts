/**
 * AI 이미지 어댑터 (docs/SPEC.md §1·§6.5) — 썸네일 스튜디오 배경 생성.
 *
 * `AI_IMAGE_PROVIDER`(기본 openai) · `AI_IMAGE_MODEL`(기본 gpt-image-1) · `AI_IMAGE_API_KEY`.
 *
 * **왜 Supabase Storage에 안 올리고 data URL을 돌려주는가**
 * 스튜디오는 캔버스에 배경을 그린 뒤 `toBlob()`으로 PNG를 내보낸다. 배경을 외부(교차 출처)
 * URL에서 불러오면 캔버스가 오염(taint)돼 `toBlob()`이 SecurityError로 터진다 —
 * 즉 다운로드 기능이 통째로 깨진다. CORS 헤더 + `img.crossOrigin`을 정확히 맞추면 피할 수
 * 있지만, 버킷·정책·수명 관리까지 붙는다. data URL은 그 문제가 없고 저장소도 필요 없다.
 * 생성 결과를 영구 보관해야 할 요구가 생기면 그때 Storage를 붙이면 된다.
 */
import { openaiFetch } from "./fetch";

export interface ThumbnailBgInput {
  ingredient: string;
  symptom?: string;
  /** docs/UI-PLAN.md §7 프롬프트 템플릿 기반 자동 구성 */
  extraPrompt?: string;
  width: number;
  height: number;
}

export interface PersonCutoutInput {
  /** 예: "40대 남성" */
  persona: string;
  /** 예: "정장", "흰 가운" */
  outfit?: string;
}

export interface ImageProvider {
  /** url은 `data:image/jpeg;base64,...` 형태의 data URL이다 (위 주석 참고) */
  generateThumbnailBackground(input: ThumbnailBgInput): Promise<{ url: string }>;
  /** 후킹페이지(세로 860×1080) 배경 — 가운데를 비워 제품이 들어갈 자리를 남긴다 */
  generateHookBackground(input: ThumbnailBgInput): Promise<{ url: string }>;
  /**
   * 배경이 투명한 인물 컷아웃 (data:image/png).
   *
   * 인물은 **생성**해도 된다 — AI가 만든 가상 인물이라 초상권 문제가 없고, 제품 사진과 달리
   * 원본을 보존해야 할 대상이 아니다. (반대로 **제품 이미지는 AI로 편집하면 안 된다**:
   * gpt-image-1의 images/edits는 편집이 아니라 재생성이라 패키지의 한글 표시사항이
   * 깨진다. 실측에서 "종근당"이 "증근당"으로 나왔다 — 표시광고법 위반 소지.)
   */
  generatePersonCutout(input: PersonCutoutInput): Promise<{ url: string }>;
}

/**
 * 배경 프롬프트.
 *
 * 지켜야 할 것 두 가지:
 *  1. **글자가 없을 것.** 원료명·카피·배지는 캔버스에서 한글 폰트로 따로 올린다.
 *     이미지 모델이 그린 글자는 한글이 깨지고 우리 텍스트와 겹쳐 못 쓰게 된다.
 *  2. **중앙·하단이 비어 있을 것.** 그 자리에 텍스트 블록이 올라간다.
 *
 * **부정문을 나열하지 않는다.** 이미지 모델은 "캡슐을 그리지 마세요"를 잘 못 지키고,
 * 오히려 그 단어에 반응해 캡슐을 더 그린다(실측: 금지 문구를 늘렸더니 계속 나왔다).
 * 그래서 **원하는 것만** 적는다 — "원물 플랫레이"라고 하면 제품 형태는 알아서 빠진다.
 * 제품 형태를 배경에 그리면 셀러 실제 상품(정제인데 배경은 소프트젤)과 어긋나
 * 표시광고법상 오인 소지가 생기므로 원물만 나오게 하는 게 맞다.
 * 글자 금지만 예외로 남긴다 — 이건 실측에서 잘 지켜졌고 타협할 수 없는 조건이다.
 */
function buildPrompt(input: ThumbnailBgInput): string {
  const subject = [input.ingredient, input.symptom].filter(Boolean).join(" · ");
  return [
    `건강기능식품 상품 썸네일용 배경 사진. 주제: ${subject || "건강기능식품"}.`,
    `${input.ingredient || "원료"}의 원물 — 신선한 식물, 꽃, 잎, 열매, 씨앗 — 만 담은 플랫레이.`,
    "소재는 프레임 가장자리에만 두고, 중앙과 하단은 넓게 비웁니다.",
    "깨끗한 흰색~아이보리 단색 배경, 부드러운 자연광, 사실적인 음식 사진 스타일.",
    "글자·숫자·로고·워터마크는 넣지 않습니다.",
    input.extraPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 후킹페이지 배경 프롬프트 — **상품의 특성을 반영한다.**
 *
 * 썸네일용 `buildPrompt`와 다른 점:
 *  - 세로 구도(1024×1536). 캔버스와 같은 크기라 리샘플링이 없다.
 *  - **가운데 가로 띠를 비운다.** 그 자리에 실제 상품 사진이 합성된다(render.ts BAND_TOP).
 *    비워두라고 말하지 않으면 소재가 화면 전체에 깔려 제품이 묻힌다.
 *  - 원료의 원물을 상·하단 모서리에 배치해 레퍼런스 상세페이지의 구성을 따른다.
 *
 * 규칙은 썸네일과 같다 — **부정문을 나열하지 않는다.** 이미지 모델은 "캡슐을 그리지
 * 마세요"를 잘 못 지키고 오히려 그 단어에 반응한다. 원하는 것만 적으면 제형은 알아서 빠진다.
 * 글자 금지만 예외로 남긴다(실측에서 잘 지켜졌고 타협할 수 없는 조건).
 */
function buildHookPrompt(input: ThumbnailBgInput): string {
  const material = input.ingredient || "건강 원물";
  return [
    "건강기능식품 상세페이지 상단용 세로 배경 이미지.",
    `${material}의 원물 — 신선한 열매·잎·씨앗·결정 — 을 화면 위쪽 모서리와 아래쪽 모서리에 나눠 배치한 광고 사진.`,
    "화면 한가운데 가로로 넓은 띠는 부드러운 단색으로 비워 둡니다. 그 자리에 제품이 놓입니다.",
    input.symptom ? `${input.symptom}을 떠올리게 하는 맑고 정돈된 분위기.` : "",
    "은은한 파스텔 그라디언트 배경, 부드러운 확산광, 미세한 빛번짐, 고급스러운 제품 광고 톤.",
    "글자·숫자·로고·워터마크는 넣지 않습니다.",
    input.extraPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}

class OpenAIImageProvider implements ImageProvider {
  constructor(
    private key: string,
    private model: string,
  ) {}

  /** images/generations 공통 호출 — b64를 data URL로 돌려준다 */
  private async generate(
    prompt: string,
    opts: { transparent?: boolean; size?: string } = {},
  ): Promise<{ url: string }> {
    const png = opts.transparent === true;
    const res = await openaiFetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        size: opts.size ?? "1024x1024",
        quality: process.env.AI_IMAGE_QUALITY ?? "medium",
        n: 1,
        // 투명은 png만 지원. 배경은 무손실이 필요 없어 jpeg로 받아 응답 크기를 줄인다
        // (png b64는 2~4MB, jpeg는 100~200KB).
        ...(png
          ? { background: "transparent", output_format: "png" }
          : { output_format: "jpeg", output_compression: 80 }),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`이미지 생성 실패 (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("이미지 생성 응답에 b64_json이 없습니다.");
    return { url: `data:image/${png ? "png" : "jpeg"};base64,${b64}` };
  }

  async generatePersonCutout(input: PersonCutoutInput): Promise<{ url: string }> {
    const outfit = input.outfit?.trim() || "깔끔한 정장";
    return this.generate(
      [
        `건강기능식품 광고용 인물 컷아웃. ${input.persona} 한국인 모델, ${outfit} 차림.`,
        "정면 상반신, 팔짱을 끼고 자신감 있고 신뢰감 있는 표정.",
        "인물만 남기고 배경은 완전히 투명. 바닥·그림자·소품 없음.",
        "밝은 스튜디오 조명의 사실적인 인물 사진. 글자·로고는 넣지 않습니다.",
      ].join("\n"),
      { transparent: true },
    );
  }

  async generateThumbnailBackground(input: ThumbnailBgInput): Promise<{ url: string }> {
    // 프리셋이 전부 정사각형(1000·1080)이라 1024 정사각으로 받아 캔버스에서 늘린다.
    return this.generate(buildPrompt(input));
  }

  async generateHookBackground(input: ThumbnailBgInput): Promise<{ url: string }> {
    // 캔버스가 1024×1536이라 같은 크기로 받는다 — 리샘플링 없이 1:1로 들어간다.
    return this.generate(buildHookPrompt(input), { size: "1024x1536" });
  }
}

export function getImageProvider(): ImageProvider {
  const provider = process.env.AI_IMAGE_PROVIDER ?? "openai";
  const key = process.env.AI_IMAGE_API_KEY;
  if (!key) {
    throw new Error(
      "AI_IMAGE_API_KEY가 없습니다. 키를 넣기 전까지는 부위 테마 그라디언트 배경이 쓰입니다.",
    );
  }
  if (provider !== "openai") {
    throw new Error(`지원하지 않는 이미지 provider: ${provider} (현재 openai만 구현)`);
  }
  return new OpenAIImageProvider(key, process.env.AI_IMAGE_MODEL ?? "gpt-image-1");
}
