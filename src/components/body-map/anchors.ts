/**
 * 3D 인체 모델 자산 경로와 계통 핫스팟 앵커.
 * 앵커는 모델 정규화 공간(높이 2, 발 -1 ~ 머리 +1, 원점 중앙) 기준 좌표 —
 * body_categories.svg_region id로 매핑한다 (2D BodyMapSvg의 REGION_GEOMETRY와 동일한 키 체계).
 */

export const BODY_MODEL_URL = "/models/body.glb";

export const REGION_ANCHORS: Record<string, [number, number, number]> = {
  hair: [0, 0.99, 0.02],
  head: [0, 0.87, 0.11],
  face: [0, 0.76, 0.12],
  lungs: [0.15, 0.45, 0.11],
  heart: [-0.05, 0.38, 0.13],
  abdomen: [0, 0.12, 0.14],
  pelvis: [0, -0.12, 0.13],
  joints: [0.14, -0.52, 0.09],
};

export const ANCHORED_REGIONS = Object.keys(REGION_ANCHORS);
