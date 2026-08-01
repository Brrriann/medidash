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

/** 채널 코드 → 사람이 읽는 이름. 모르는 코드는 그대로 보여준다. */
const CHANNEL: Record<string, string> = {
  cjmall: "CJ온스타일", cjmallplus: "CJ온스타일+", gsshop: "GS샵", gsmyshop: "GS마이샵",
  lotteimall: "롯데홈쇼핑", lotteonetv: "롯데원티비", hmall: "현대홈쇼핑", hmallplus: "현대+",
  nsmall: "NS홈쇼핑", nsmallplus: "NS+", kshop: "K쇼핑", kshopplus: "K쇼핑+",
  shopnt: "SK스토아", bshop: "신세계쇼핑", ssgshop: "SSG", wshop: "W쇼핑",
  hnsmall: "홈앤쇼핑", immall: "공영쇼핑",
};
export const channelName = (code: string): string => CHANNEL[code] ?? code;

/** 화면에 그대로 뿌릴 수 있게 펼쳐 둔 예정 방송 한 건. */
export interface UpcomingRow {
  name: string;
  channel: string;
  at: string;
  ingredient: string;
  lead: LeadTime;
}

/** upcoming을 가진 최소 형태 — 호출부의 BroadcastStat을 그대로 받는다. */
type HasUpcoming = { upcoming: { name: string; channel: string; at: string }[] };

/**
 * 원료별로 흩어져 있는 예정 방송을 한 줄짜리 목록으로 펼친다.
 *
 * **중복을 걷어내는 이유**: 복합 영양제 하나가 비타민A·C·E에 모두 잡히므로
 * 그냥 펼치면 같은 상품이 목록을 도배한다. 상품명+시각으로 같은 방송을 하나로 본다.
 * 이때 남는 원료는 처음 만난 것 하나뿐이라, 어느 원료로 잡혔는지는 참고값이다.
 *
 * 정렬은 **남은 시간이 긴 순** — 이유는 이 파일 첫머리에 적어 뒀다.
 */
export function upcomingRows(
  broadcast: Record<string, HasUpcoming>,
  now: number,
): UpcomingRow[] {
  const seen = new Set<string>();
  return Object.entries(broadcast)
    .flatMap(([ingredient, s]) =>
      s.upcoming.map((u) => ({ ...u, ingredient, lead: leadTime(u.at, now) })),
    )
    .filter((r): r is UpcomingRow => r.lead !== null)
    .sort((a, b) => b.lead.days - a.lead.days)
    .filter((r) => {
      const k = `${r.name}|${r.at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
