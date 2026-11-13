/**
 * ===== 쉬운 설명 =====
 * 무엇: 화면 위쪽 메뉴 바. 역할에 따라 보이는 메뉴가 달라집니다.
 * 언제: 로그인 후 대부분의 화면.
 * 리뷰 포인트: 수강생에게는 '실습'만, 강사에게는 '강사 대시보드'까지, 관리자에게는 '시나리오·사용자·사용량'까지 보이는지 확인하세요.
 * =====================
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";
import { NavLinks } from "./NavLinks";

const ROLE_LABEL = { learner: "수강생", instructor: "강사", admin: "운영 관리자" } as const;

export function AppShell({ user, children, wide }: { user: CurrentUser; children: ReactNode; wide?: boolean }) {
  const role = user.profile.role;
  const links: { href: string; label: string }[] = [];
  if (role === "learner" || role === "admin" || role === "instructor") links.push({ href: "/learn", label: "실습" });
  if (role === "instructor" || role === "admin") links.push({ href: "/instructor", label: "강사 대시보드" });
  if (role === "admin") {
    links.push({ href: "/admin/scenarios", label: "시나리오" });
    links.push({ href: "/admin/users", label: "사용자" });
    links.push({ href: "/admin/usage", label: "사용량" });
  }
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="font-bold text-brand-600">
            인허브 리허설
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <Link href="/account" className="rounded-md px-2 py-1 hover:bg-slate-100" title="내 계정">
              {user.profile.name} <span className="text-slate-400">· {ROLE_LABEL[role]}</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className={wide ? "mx-auto max-w-7xl px-4 py-6" : "mx-auto max-w-5xl px-4 py-6"}>{children}</main>
    </div>
  );
}
