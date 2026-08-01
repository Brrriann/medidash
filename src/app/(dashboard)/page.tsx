import Link from "next/link";
import { getBroadcastStats, getRecentWorks } from "@/lib/data";
import { BroadcastTrend } from "@/components/dashboard/BroadcastTrend";
import { PageHeader } from "@/components/ui/PageHeader";

const WORK_LABELS: Record<string, string> = {
  thumbnail: "썸네일",
  title_tags: "상품명·태그",
  margin: "마진 계산",
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * 홈은 대시보드가 아니라 런처다.
 *
 * 셀러가 로그인해서 하는 일은 "지금부터 뭘 하지"를 고르는 것 하나뿐이라,
 * 지표를 늘어놓기보다 다음 화면으로 보내는 카드를 크게 놓는다.
 * 아래 3개는 찾기 → 만들기 순서 그대로다.
 */
const PRIMARY = [
  {
    href: "/map",
    title: "증상으로 원료 찾기",
    desc: "인체 지도에서 계통을 고르면 증상 키워드와 추천 원료까지 이어집니다.",
    cta: "지도 열기",
    icon: (
      <svg {...iconProps} aria-hidden>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M5 10h14M12 7.5V21M8 21l4-6 4 6" />
      </svg>
    ),
  },
  {
    href: "/sourcing",
    title: "도매 상품 소싱",
    desc: "건온연·건강산·유픽 3사 상품 캐시를 원료·키워드로 한 번에 검색합니다.",
    cta: "상품 찾기",
    icon: (
      <svg {...iconProps} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/studio",
    title: "썸네일 만들기",
    desc: "AI 배경·인물에 상품 누끼를 얹고 플랫폼 프리셋 크기로 내려받습니다.",
    cta: "스튜디오 열기",
    icon: (
      <svg {...iconProps} aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m3 17 5-4 4 3 4-4 5 5" />
      </svg>
    ),
  },
];

const TOOLS = [
  {
    href: "/titles",
    title: "상품명·태그",
    desc: "노출도 등급이 붙은 상품명과 태그 20개",
  },
  {
    href: "/margin",
    title: "마진 계산",
    desc: "수수료·세금 제외 실마진과 손익분기",
  },
  {
    href: "/my",
    title: "작업 기록",
    desc: "저장한 썸네일·상품명·계산 이력",
  },
];

export default async function HomePage() {
  const [recentWorks, broadcast] = await Promise.all([
    getRecentWorks(),
    getBroadcastStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="오늘 할 작업을 선택하세요"
        description="원료를 찾고, 상품을 고르고, 썸네일과 상품명까지 한 자리에서 이어서 만듭니다."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            /* 들어 올리는 대신 테두리를 진하게 한다 — 원장 문법에서는 면이 뜨지 않는다 */
            className="card group flex flex-col p-5 transition hover:border-slate-400"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
              {item.icon}
            </span>
            <h2 className="mt-4 text-base font-bold text-slate-900">{item.title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">
              {item.desc}
            </p>
            <span className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-800">
              {item.cta}
              <svg
                {...iconProps}
                width={16}
                height={16}
                aria-hidden
                className="transition group-hover:translate-x-0.5"
              >
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-800">운영 도구</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TOOLS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-400"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {item.desc}
                </span>
              </span>
              <svg
                {...iconProps}
                width={15}
                height={15}
                aria-hidden
                className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
              >
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <BroadcastTrend broadcast={broadcast} now={Date.now()} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-800">최근 작업</h2>
        {recentWorks.length === 0 ? (
          <div className="flex h-28 flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-400">아직 작업 이력이 없습니다</p>
            <p className="mt-1 text-xs text-slate-400">
              썸네일·상품명·마진 계산 결과가 여기에 쌓입니다
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recentWorks.map((w, i) => (
              <li key={i} className="flex justify-between py-2">
                <span className="text-slate-700">
                  {WORK_LABELS[w.kind] ?? w.kind}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(w.createdAt).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
