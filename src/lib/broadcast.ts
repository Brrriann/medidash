/**
 * 홈쇼핑 방송 예정까지 남은 시간.
 *
 * **왜 "가까운 순"이 아니라 "남은 시간이 긴 순"인가**
 * 홈쇼핑 편성표는 열흘치까지만 공개된다 — 실측(예정 편성 325건)에서 최대 D-9,
 * 중앙값 D-0.8이었고 14일 이상은 한 건도 없었다. 홈쇼핑모아가 원료당 상위 10건만
 * 주는 상한 때문이 아니다: 10건이 꽉 찬 원료(최대 8.8일)보다 전량 수집된
 * 원료(최대 9.8일)가 오히려 멀었다.
 *
 * 그 분포에서 58%가 "오늘 방송"이라, 가까운 순으로 정렬하면 오늘치가 화면을 다 먹는다.
 * 위탁판매라 재고 부담은 없지만 상세페이지·썸네일 준비에는 며칠이 필요하므로,
 * 준비할 시간이 남은 쪽을 위로 올린다.
 *
 * 컴포넌트가 아니라 여기 두는 이유는 테스트에서 React 없이 부르기 위해서다.
 */

export interface LeadTime {
  /** 지금부터 방송까지 남은 일수 (소수) */
  days: number;
  /** 화면에 그대로 쓰는 한국어 라벨 */
  label: string;
  /** 여유도 색 — 5일 이상 여유 / 2일 이상 보통 / 그 외 임박 */
  tone: string;
}

const DAY_MS = 86_400_000;

/** 이미 지났거나 일시를 못 읽으면 null — 호출부가 목록에서 걸러낸다. */
export function leadTime(at: string, now: number): LeadTime | null {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  const days = (t - now) / DAY_MS;
  if (days < 0) return null;
  return {
    days,
    label: days < 1 ? "오늘" : days < 2 ? "내일" : `${Math.floor(days)}일 남음`,
    tone:
      days >= 5
        ? "bg-brand-50 text-brand-700"
        : days >= 2
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-500",
  };
}
