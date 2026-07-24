"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
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

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "대시보드",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    href: "/sourcing",
    label: "도매몰 검색",
    badge: "W2",
    icon: (
      <svg {...iconProps} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/studio",
    label: "썸네일 스튜디오",
    badge: "W3",
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
    badge: "W3",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
        <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/margin",
    label: "마진계산기",
    badge: "W3",
    icon: (
      <svg {...iconProps} aria-hidden>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8.5 7.5h7M8.5 12h2.5M8.5 16h2.5M13.5 12h2M13.5 16h2" />
      </svg>
    ),
  },
  {
    href: "/my",
    label: "마이페이지",
    icon: (
      <svg {...iconProps} aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
      </svg>
    ),
  },
];

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
  const items = showAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link href="/" className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          M
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">
          MediDash
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((item) => {
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
              {item.badge && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <p className="px-5 py-4 text-[10px] leading-relaxed text-slate-300">
        인체 지도 → 원료 → 소싱 → AI 산출물 → 마진까지 원스톱
      </p>
    </aside>
  );
}
