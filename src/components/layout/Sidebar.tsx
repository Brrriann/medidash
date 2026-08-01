"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";

/**
 * 좌측 길잡이.
 *
 * **넓은 사이드바를 레일로 줄였다.** 종전 `w-64`(256px)는 창 크기와 무관하게 폭을 먼저
 * 가져갔다 — 1280px 노트북에서 본문에 남는 폭이 976px이었다. 캔버스가 필요한 스튜디오와
 * 표가 넓어야 하는 편성·소싱이 전부 여기서 손해를 봤다.
 *
 * 아이콘만 남기지 않고 **짧은 한글 라벨을 함께 둔다.** 수강생 대부분이 초보라
 * 아이콘 열 개를 해독하게 하면 안 된다. 64px에 4글자까지 들어간다.
 *
 * 갈래(찾기·만들기·운영)는 제목 대신 **가는 괘선**으로 나눈다 — 64px에 그룹 제목은
 * 안 들어가지만, 묶여 있다는 사실은 남겨야 한다. 그 묶음이 셀러의 작업 순서다.
 *
 * 모바일은 종전 드로어를 그대로 쓴다. 좁은 화면에서는 폭보다 설명이 아쉽다.
 */

interface NavItem {
  href: string;
  label: string;
  /** 레일용 짧은 이름 — 64px에 들어가야 한다 */
  short: string;
  /** 드로어에서 이름 아래 붙는 한 줄 설명 */
  desc: string;
  icon: React.ReactNode;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const iconProps = {
  width: 18,
  height: 18,
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
        short: "홈",
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
        short: "증상지도",
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
        short: "상품소싱",
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
        short: "홈쇼핑",
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
        short: "썸네일",
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
        short: "상품명",
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
        short: "후킹",
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
        short: "CS답변",
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
        short: "마진",
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
  short: "내계정",
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
  short: "관리자",
  desc: "초대코드와 데이터 갱신",
  icon: (
    <svg {...iconProps} aria-hidden>
      <path d="M12 3 4.5 6v5c0 4.5 3 8.5 7.5 10 4.5-1.5 7.5-5.5 7.5-10V6L12 3Z" />
    </svg>
  ),
};

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({
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
  const isActive = useActive();

  // 메뉴로 이동하면 모바일 드로어를 닫는다
  useEffect(() => setOpen(false), [pathname]);

  // 드로어가 열려 있을 때 Esc로 닫기
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
      {/* ── 모바일 햄버거 ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="fixed left-3 top-3 z-30 rounded-md border border-slate-200 bg-white p-2 text-slate-600 md:hidden"
      >
        <svg {...iconProps} width={18} height={18} aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          aria-hidden
        />
      )}

      {/* ── 모바일 드로어 — 이름과 설명을 다 보여준다 ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform md:hidden ${
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

        <Account email={email} mock={mock} wide />
      </aside>

      {/* ── 데스크톱 레일 ──
          sticky + h-screen으로 화면에 붙여 둔다. 종전에는 본문과 함께 위로 밀려 올라가
          스튜디오처럼 긴 화면에서 스크롤을 내리면 메뉴가 통째로 사라졌다. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
        <Link
          href="/"
          className="flex h-14 items-center justify-center border-b border-slate-100"
          title="헬스셀러"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            H
          </span>
        </Link>

        <nav className="flex-1 py-2">
          {groups.map((group, gi) => (
            <div
              key={group.title}
              /* 그룹 제목은 64px에 안 들어간다. 대신 괘선으로 나눠 묶음만 남긴다. */
              className={gi > 0 ? "mt-2 border-t border-slate-100 pt-2" : ""}
            >
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={`${item.label} — ${item.desc}`}
                    className={`flex flex-col items-center gap-1 border-l-2 px-1 py-2.5 transition ${
                      active
                        ? "border-brand-600 bg-brand-50/70 text-brand-800"
                        : "border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    {item.icon}
                    <span
                      className={`text-[10px] leading-tight ${active ? "font-bold" : "font-medium"}`}
                    >
                      {item.short}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <Account email={email} mock={mock} />
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
        H
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold tracking-[0.16em] text-slate-400 uppercase">
          Health Seller
        </span>
        <span className="block text-lg font-bold tracking-tight text-slate-900">
          헬스셀러
        </span>
      </span>
    </Link>
  );
}

/**
 * 계정 칸.
 *
 * 종전에는 본문 위 별도 헤더(56px)에 있었다. 그 띠가 담은 것이 mock 배지와 이메일뿐이라
 * 페이지 머리글과 머리띠가 두 겹이 됐다. 레일 아래로 옮기고 그 띠를 지웠다.
 */
function Account({
  email,
  mock,
  wide,
}: {
  email: string | null;
  mock: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`border-t border-slate-100 ${wide ? "space-y-2 px-5 py-4" : "space-y-1.5 px-1.5 py-3"}`}
    >
      {mock && (
        <p
          title="Supabase 미연결 — 시드 데이터로 동작 중입니다"
          className={`rounded bg-accent-50 font-bold text-accent-700 ${
            wide
              ? "px-2.5 py-1 text-[11px]"
              : "px-1 py-1 text-center text-[9px] leading-tight"
          }`}
        >
          {wide ? "Mock 모드 — Supabase 미연결" : "MOCK"}
        </p>
      )}

      {email ? (
        <>
          {wide && <p className="truncate text-[11px] text-slate-500">{email}</p>}
          <form action={signOutAction}>
            <button
              type="submit"
              title={wide ? undefined : `${email} — 로그아웃`}
              className={`w-full rounded-md border border-slate-200 font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700 ${
                wide ? "px-3 py-1.5 text-xs" : "px-1 py-1.5 text-[10px]"
              }`}
            >
              로그아웃
            </button>
          </form>
        </>
      ) : (
        <Link
          href="/login"
          className={`block rounded-md border border-slate-200 text-center font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700 ${
            wide ? "px-3 py-1.5 text-xs" : "px-1 py-1.5 text-[10px]"
          }`}
        >
          로그인
        </Link>
      )}
    </div>
  );
}
