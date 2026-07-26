"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
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

/** 셀러의 작업 순서(찾기 → 만들기 → 정산)를 메뉴 구조로 그대로 드러낸다. */
const GROUPS: NavGroup[] = [
  {
    title: "찾기",
    items: [
      {
        href: "/",
        label: "증상 지도",
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
        icon: (
          <svg {...iconProps} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
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
        icon: (
          <svg {...iconProps} aria-hidden>
            <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "정산",
    items: [
      {
        href: "/margin",
        label: "마진 계산",
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
  icon: (
    <svg {...iconProps} aria-hidden>
      <path d="M12 3 4.5 6v5c0 4.5 3 8.5 7.5 10 4.5-1.5 7.5-5.5 7.5-10V6L12 3Z" />
    </svg>
  ),
};

export function Sidebar({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
    {
      title: "내 정보",
      items: showAdmin ? [MY_ITEM, ADMIN_ITEM] : [MY_ITEM],
    },
  ];

  return (
    <>
      {/* 모바일 햄버거 — 헤더 왼쪽 여백(pl-16)에 얹힌다 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="fixed left-3 top-3 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm md:hidden"
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

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              H
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              헬스셀러
            </span>
          </Link>
          {/* 드로어가 열리면 햄버거가 가려지므로 닫기 버튼을 안쪽에 둔다 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="-mr-1 rounded-lg p-1 text-slate-400 hover:text-slate-700 md:hidden"
          >
            <svg {...iconProps} width={18} height={18} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-4 px-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <p className="px-5 py-4 text-[11px] leading-relaxed text-slate-400">
          인체 지도에서 시작해 마진까지 한 번에.
        </p>
      </aside>
    </>
  );
}
