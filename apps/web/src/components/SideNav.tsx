"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 왼쪽 사이드바 메뉴(넓은 화면) / 위쪽 가로 메뉴(휴대폰). 지금 보고 있는 화면의 메뉴를 강조합니다.
 * 언제: 로그인 후 상단 메뉴가 있는 모든 화면 (AppShell 안).
 * 리뷰 포인트: 주소가 메뉴 주소로 시작하면 '현재 메뉴'로 보고, 가장 길게 일치하는 하나만 강조합니다.
 *         '곧 출시'·'준비 중' 메뉴는 누를 수 없게 표시만 합니다.
 * =====================
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavIcon = "home" | "play" | "exam" | "class" | "chart" | "ticket" | "user" | "book" | "users" | "coin";
export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** '곧 출시'처럼 아직 못 쓰는 메뉴 */
  soon?: string;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

const PATHS: Record<NavIcon, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  play: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 8.5l6 3.5-6 3.5z",
  exam: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3",
  class: "M3 7l9-4 9 4-9 4zM7 9v5c0 1.7 2.2 3 5 3s5-1.3 5-3V9",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  ticket: "M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM14 6v12",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13",
  users: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20c1-3.5 3.8-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M14.5 9.5c0-1.2-1.1-2-2.5-2s-2.5.8-2.5 2 1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2-2.5-.8-2.5-2",
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname() ?? "";
  const all = groups.flatMap((g) => g.items).filter((i) => !i.soon);
  const active = all
    .filter((l) => path === l.href || path.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="주 메뉴" className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
      {groups.map((g, gi) => (
        <div key={gi} className="flex shrink-0 gap-1 md:flex-col md:gap-0.5">
          {g.title && <div className="hidden px-3 pb-1.5 pt-3.5 text-xs font-semibold text-slate-500 md:block">{g.title}</div>}
          {g.items.map((it) => {
            const on = it.href === active;
            const cls = clsx(
              "flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm",
              on ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600",
              !it.soon && !on && "hover:bg-slate-100",
            );
            return it.soon ? (
              <span key={it.label} aria-disabled="true" className={clsx(cls, "cursor-default text-slate-400")}>
                <Icon name={it.icon} />
                {it.label}
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{it.soon}</span>
              </span>
            ) : (
              <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={cls}>
                <Icon name={it.icon} />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
