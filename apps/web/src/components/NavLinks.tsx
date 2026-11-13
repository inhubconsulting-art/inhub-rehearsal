"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 상단 메뉴. 지금 보고 있는 화면의 메뉴를 진하게 강조합니다.
 * 리뷰 포인트: 주소가 메뉴 주소로 시작하면 '현재 메뉴'로 봅니다. (예: /instructor/cohorts/123 → 강사 대시보드)
 * =====================
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname() ?? "";
  // 가장 길게 일치하는 메뉴 하나만 강조합니다.
  const active = links
    .filter((l) => path === l.href || path.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex gap-1 text-sm">
      {links.map((l) => {
        const on = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "rounded-md px-3 py-1.5",
              on ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
