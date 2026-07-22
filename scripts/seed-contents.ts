/**
 * 고객 제공 콘텐츠(부위별 원료/기전/셀링포인트) 적재 스크립트 — 자료 수령 후 구현 (W4).
 *
 * 예정 입력: 고객 CSV/엑셀
 *   - subcategory_contents: 중분류 slug, 특징(feature), 기전(mechanism), 셀링포인트(selling_points)
 *   - ingredients: 원료명, 별칭, 인증구분(고시형/개별인정형), 일일 섭취량
 *   - symptom_ingredients: 증상 키워드 ↔ 원료 매핑
 *
 * 범위 가드(docs/SPEC.md §2): 콘텐츠는 창작하지 않고 고객 제공 데이터를 적재만 한다.
 */
console.error(
  "⏳ seed-contents 는 고객 자료(CSV/엑셀) 수령 후 구현됩니다 (W4).\n" +
    "   현재는 npm run seed 의 분류 체계 + 원료 샘플만 적재됩니다.",
);
process.exit(1);
