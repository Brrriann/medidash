"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";

/**
 * 상단 가로 내비.
 *
 * **사이드바를 없앤다.** 좌측 기둥은 창 크기와 무관하게 폭을 먼저 가져갔다 —
 * 넓은 사이드바(256px) 시절엔 1280px 노트북에서 본문에 976px만 남았고, 레일(64px)로
 * 줄여도 여전히 상시 소모였다. 가로로 눕히면 그 폭이 통째로 본문에 돌아온다.
 * 캔버스가 필요한 스튜디오와 표가 넓어야 하는 편성·소싱이 가장 크게 이득이다.
 *
 * **두 줄로 나눈다.** 1행은 브랜드와 계정, 2행은 메뉴다. 한 줄에 다 넣으면 메뉴가
 * 계정 정보와 같은 높이에서 경쟁해 어느 쪽도 안 읽힌다.
 *
 * **갈래(찾기·만들기·운영)는 세로 괘선으로 나눈다.** 가로 배열의 약점이 묶음이
 * 흐려지는 것인데, 이 서비스의 메뉴 구조는 장식이 아니라 셀러의 작업 순서라
 * 그 관계를 잃으면 안 된다. 이름은 그대로 다 보인다 — 아이콘 해독 부담이 없다.
 *
 * 모바일은 드로어를 그대로 쓴다. 가로 메뉴 11개는 좁은 화면에서 접히지 않는다.
 */

interface NavItem {
  href: string;
  label: string;
  /** 드로어에서 이름 아래 붙는 한 줄 설명 */
  desc: string;
  icon: React.ReactNode;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** 셀러의 작업 순서(찾기 → 만들기 → 운영 → 정산)를 메뉴 구조로 그대로 드러낸다. */
const GROUPS: NavGroup[] = [
  {
    title: "시작",
    items: [
      {
        href: "/",
        label: "홈",
        desc: "오늘 할 작업 고르기",
        icon: (
          <svg {...iconProps} aria-hidden>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "찾기",
    items: [
      {
        href: "/map",
        label: "증상 지도",
        desc: "인체 지도에서 원료 찾기",
        icon: (
          <svg {...iconProps} aria-hidden>
            <circle cx="12" cy="5" r="2.5" />
            <path d="M5 10h14M12 7.5V21M8 21l4-6 4 6" />
          </svg>
        ),
      },
      {
        href: "/sourcing",
        label: "상품 소싱",
        desc: "도매 3사 상품 캐시 검색",
        icon: (
          <svg {...iconProps} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        ),
      },
      {
        href: "/broadcast",
        label: "홈쇼핑 편성",
        desc: "예정 방송 · 준비 기간 순",
        icon: (
          <svg {...iconProps} aria-hidden>
            <rect x="3" y="7" width="18" height="12" rx="2" />
            <path d="m8 3 4 4 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "만들기",
    items: [
      {
        href: "/studio",
        label: "썸네일",
        desc: "AI 배경·인물로 대표 이미지",
        icon: (
          <svg {...iconProps} aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m3 17 5-4 4 3 4-4 5 5" />
          </svg>
        ),
      },
      {
        href: "/titles",
        label: "상품명·태그",
        desc: "노출도 등급 상품명과 태그",
        icon: (
          <svg {...iconProps} aria-hidden>
            <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
      {
        href: "/hook",
        label: "후킹페이지",
        desc: "상세페이지 상단 2장",
        icon: (
          <svg {...iconProps} aria-hidden>
            <rect x="4" y="3" width="16" height="8" rx="1.5" />
            <rect x="4" y="13" width="16" height="8" rx="1.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "운영",
    items: [
      {
        href: "/cs",
        label: "CS 답변",
        desc: "고객 문의 답변 초안 생성",
        icon: (
          <svg {...iconProps} aria-hidden>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L3 21l1.2-4.2A8.4 8.4 0 1 1 21 11.5Z" />
          </svg>
        ),
      },
      {
        href: "/margin",
        label: "마진 계산",
        desc: "수수료·세금 뺀 실제 마진",
        icon: (
          <svg {...iconProps} aria-hidden>
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M8.5 7.5h7M8.5 12h2.5M8.5 16h2.5M13.5 12h2M13.5 16h2" />
          </svg>
        ),
      },
    ],
  },
];

const MY_ITEM: NavItem = {
  href: "/my",
  label: "내 계정",
  desc: "작업 이력과 계정 정보",
  icon: (
    <svg {...iconProps} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
    </svg>
  ),
};

const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "관리자",
  desc: "초대코드와 데이터 갱신",
  icon: (
    <svg {...iconProps} aria-hidden>
      <path d="M12 3 4.5 6v5c0 4.5 3 8.5 7.5 10 4.5-1.5 7.5-5.5 7.5-10V6L12 3Z" />
    </svg>
  ),
};

export function TopNav({
  showAdmin,
  email,
  mock,
}: {
  showAdmin: boolean;
  /** 로그인한 사용자 이메일 — 없으면 로그인 링크를 보인다 */
  email: string | null;
  mock: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // 메뉴로 이동하면 모바일 드로어를 닫는다
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const groups: NavGroup[] = [
    ...GROUPS,
    { title: "내 정보", items: showAdmin ? [MY_ITEM, ADMIN_ITEM] : [MY_ITEM] },
  ];

  return (
    <>
      {/* 화면에 붙여 둔다 — 긴 화면에서 스크롤을 내려도 길잡이가 남아야 한다 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        {/* 1행 — 브랜드 · 계정 */}
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            className="-ml-1 rounded-md border border-slate-200 p-2 text-slate-600 md:hidden"
          >
            <svg {...iconProps} width={18} height={18} aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <Brand />

          <div className="flex-1" />

          {mock && (
            <span
              title="Supabase 미연결 — 시드 데이터로 동작 중입니다"
              className="hidden rounded bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-700 sm:inline"
            >
              Mock 모드 — Supabase 미연결
            </span>
          )}
          <Account email={email} />
        </div>

        {/*
          2행 — 메뉴.

          좁아지면 가로로 흐르게 둔다(overflow-x-auto). 접거나 숨기면 "메뉴가 없어졌다"가
          되고, 줄바꿈시키면 머리띠 높이가 화면마다 달라져 본문 시작점이 흔들린다.
        */}
        <nav className="hidden overflow-x-auto border-t border-slate-100 md:block">
          <div className="flex w-max items-stretch px-4 md:px-6">
            {groups.map((group, gi) => (
              <div
                key={group.title}
                className={
                  gi > 0
                    ? "ml-2 flex items-stretch border-l border-slate-200 pl-2"
                    : "flex items-stretch"
                }
              >
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.desc}
                      /* 활성 표시는 아래 밑줄 — 가로 배열에서 지금 펼친 장을 가리키는
                         가장 익은 신호다. -mb-px로 머리띠 밑선 위에 겹쳐 놓는다.

                         **아이콘은 안 넣는다.** 항목당 23px씩 먹어 열한 개면 250px인데,
                         그만큼 줄이 넘쳐 뒤쪽 메뉴가 잘렸다. 가로 배열은 이름이 계속
                         보이는 게 강점이라 아이콘이 같은 말을 두 번 하는 셈이다.
                         (드로어에는 남긴다 — 세로로 훑을 땐 아이콘이 눈을 잡아준다.) */
                      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                        active
                          ? "border-brand-700 font-bold text-brand-800"
                          : "border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
      </header>

      {/* ── 모바일 드로어 ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="-mr-1 rounded-md p-1 text-slate-400 hover:text-slate-700"
          >
            <svg {...iconProps} width={18} height={18} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-4 px-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mx-3 mb-1.5 border-b border-slate-100 pb-1 text-[10px] font-bold tracking-wide text-slate-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-r-md border-l-2 px-3 py-2.5 transition ${
                        active
                          ? "border-brand-600 bg-brand-50/70 text-slate-900"
                          : "border-transparent text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <span className={active ? "text-brand-700" : "text-slate-400"}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${active ? "font-bold" : "font-semibold"}`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`block truncate text-[11px] ${active ? "text-slate-500" : "text-slate-400"}`}
                        >
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {mock && (
          <p className="mx-5 mb-3 rounded bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-700">
            Mock 모드 — Supabase 미연결
          </p>
        )}
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-sm font-bold text-white">
        H
      </span>
      <span className="text-base font-bold tracking-tight text-slate-900">헬스셀러</span>
    </Link>
  );
}

function Account({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Link
        href="/login"
        className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
      >
        로그인
      </Link>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="hidden max-w-[14rem] truncate text-xs text-slate-500 lg:inline">
        {email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
