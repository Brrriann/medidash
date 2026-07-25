/** 원료 사전 항목 (매칭 입력) — 앱·크롤러·스크립트가 공용으로 쓴다. */
export interface IngredientDict {
  id: number;
  name: string;
  aliases: string[];
}
