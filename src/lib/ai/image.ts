/**
 * AI 이미지 어댑터 (docs/SPEC.md §1·§6.5) — W3 썸네일 스튜디오에서 구현.
 * AI_IMAGE_PROVIDER 환경변수로 openai 등 provider 전환.
 * 생성 이미지는 Supabase Storage에 저장 후 URL 반환.
 */
export interface ThumbnailBgInput {
  ingredient: string;
  symptom?: string;
  /** docs/UI-PLAN.md §7 프롬프트 템플릿 기반 자동 구성 */
  extraPrompt?: string;
  width: number;
  height: number;
}

export interface ImageProvider {
  generateThumbnailBackground(input: ThumbnailBgInput): Promise<{ url: string }>;
}

export function getImageProvider(): ImageProvider {
  const provider = process.env.AI_IMAGE_PROVIDER ?? "openai";
  // TODO(W3): openai images 구현 + Supabase Storage 업로드
  throw new Error(`AI 이미지 어댑터(${provider})는 W3에서 구현됩니다.`);
}
