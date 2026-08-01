import type { Metadata } from "next";
import { getBroadcastStats } from "@/lib/data";
import { upcomingRows } from "@/lib/broadcast";
import { BroadcastSchedule } from "@/components/broadcast/BroadcastSchedule";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTiles } from "@/components/ui/StatTiles";

export const metadata: Metadata = { title: "홈쇼핑 편성" };

export default async function BroadcastPage() {
  const broadcast = await getBroadcastStats();
  // 기준 시각은 서버에서 한 번 정해 넘긴다 — 클라이언트 시계와 어긋나면 리드타임이 흔들린다.
  const now = Date.now();
  const rows = upcomingRows(broadcast, now);

  const channels = new Set(rows.map((r) => r.channel));
  const ingredients = new Set(rows.map((r) => r.ingredient));
  const wide = rows.filter((r) => r.lead.days >= 5).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="홈쇼핑 편성"
        description={
          <>
            홈쇼핑모아에서 매일 05:00에 받아 온 <strong>예정 편성</strong>입니다. 준비 기간이
            많이 남은 방송부터 보여 줍니다 — 지금 소싱하면 수요가 오르는 구간에 맞출 수 있습니다.
          </>
        }
        aside={
          <span className="inline-flex rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
            편성표 열흘치
          </span>
        }
      />

      <StatTiles
        items={[
          { label: "예정 방송", value: rows.length.toLocaleString("ko-KR"), hint: "중복 제외" },
          { label: "채널", value: `${channels.size}개` },
          { label: "잡힌 원료", value: `${ingredients.size}종` },
          {
            label: "5일 이상 여유",
            value: wide.toLocaleString("ko-KR"),
            hint: "준비 기간 확보",
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">예정된 편성이 없습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            수집은 매일 05:00에 돌아갑니다. 편성표가 열흘치까지만 공개되므로 그보다 먼 방송은
            아직 잡히지 않습니다.
          </p>
        </div>
      ) : (
        <BroadcastSchedule rows={rows} />
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        홈쇼핑모아가 원료당 상위 10건만 제공해 방송 횟수의 정확한 순위는 알 수 없습니다. 위
        목록은 확정된 예정 편성만 보여 줍니다. 같은 방송이 여러 원료에 걸리는 경우
        (복합 영양제 하나가 비타민A·C·E에 모두 잡힙니다) 한 건으로 묶었으므로,
        &ldquo;잡힌 원료&rdquo;는 그 방송에 걸린 원료 중 하나입니다.
      </p>
    </div>
  );
}
