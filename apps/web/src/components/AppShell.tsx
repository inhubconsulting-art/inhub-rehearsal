/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인 후 화면의 공통 틀. 넓은 화면에서는 왼쪽 사이드바, 휴대폰에서는 위쪽 가로 메뉴로 바뀝니다. 역할에 따라 메뉴가 다릅니다.
 *  - 수강생: 홈 / 학습(연습하기, 모의고사(곧 출시), 내 교육) / 기록(내 기록·리포트) / 계정(이용권, 내 계정)
 *  - 강사  : 운영(교육 차수) / 연습(연습하기) / 계정
 *  - 관리자: 운영(교육 차수) / 콘텐츠(시나리오, 모의고사 문항(곧 출시)) / 관리(사용자·이용권, 사용량·비용, 분석(준비 중)) / 연습 / 계정
 * 언제: 로그인 후 대부분의 화면.
 * 리뷰 포인트: 탭을 처음 열 때 '접속' 기록을 한 번 남깁니다(VisitTracker, 화면에는 안 보임).
 *         화면 맨 아래에는 이용약관·개인정보처리방침 링크가 항상 보입니다(법령상 상시 게시 의무).
 *         수강생은 사이드바 아래에 남은 이용권 횟수가 보입니다.
 * =====================
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { getPassBalance } from "@/lib/practice";
import { LogoutButton } from "./LogoutButton";
import { SideNav, type NavGroup } from "./SideNav";
import { VisitTracker } from "./tracking/VisitTracker";
import { LogoMark } from "@/components/LogoMark";

const ROLE_LABEL = { learner: "수강생", instructor: "강사", admin: "운영 관리자" } as const;

function navFor(role: CurrentUser["profile"]["role"]): NavGroup[] {
  if (role === "learner") {
    return [
      { items: [{ href: "/home", label: "홈", icon: "home" }] },
      {
        title: "학습",
        items: [
          { href: "/practice", label: "연습하기", icon: "play" },
          { href: "/exam", label: "모의고사", icon: "exam", soon: "곧 출시" },
          { href: "/learn", label: "내 교육", icon: "class" },
        ],
      },
      { title: "기록", items: [{ href: "/learn/history", label: "내 기록·리포트", icon: "chart" }] },
      {
        title: "계정",
        items: [
          { href: "/pass", label: "이용권", icon: "ticket" },
          { href: "/account", label: "내 계정", icon: "user" },
        ],
      },
    ];
  }
  const groups: NavGroup[] = [{ title: "운영", items: [{ href: "/instructor", label: "교육 차수", icon: "class" }] }];
  if (role === "admin") {
    groups.push(
      {
        title: "콘텐츠",
        items: [
          { href: "/admin/scenarios", label: "시나리오", icon: "book" },
          { href: "/admin/lexicon", label: "표현 목록", icon: "quote" },
          { href: "/admin/exams", label: "모의고사 문항", icon: "exam", soon: "곧 출시" },
        ],
      },
      {
        title: "관리",
        items: [
          { href: "/admin/users", label: "사용자·이용권", icon: "users" },
          { href: "/admin/usage", label: "사용량·비용", icon: "coin" },
          { href: "/admin/analytics", label: "분석", icon: "chart" },
        ],
      },
    );
  }
  groups.push(
    { title: "연습", items: [{ href: "/practice", label: "연습하기", icon: "play" }] },
    { title: "계정", items: [{ href: "/account", label: "내 계정", icon: "user" }] },
  );
  return groups;
}

export async function AppShell({ user, children, wide }: { user: CurrentUser; children: ReactNode; wide?: boolean }) {
  const role = user.profile.role;
  const isLearner = role === "learner";
  const balance = isLearner ? await getPassBalance(user.id).catch(() => null) : null;
  const cta = isLearner ? { href: "/practice", label: "연습 시작" } : { href: "/instructor/cohorts/new", label: "교육 차수 만들기" };

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 md:h-screen md:w-60 md:shrink-0 md:gap-3.5 md:overflow-y-auto md:border-b-0 md:border-r md:px-3.5 md:py-5">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 px-1.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
              <LogoMark className="h-6 w-6" />
            </span>
            <span className="font-extrabold text-slate-900">인허브 리허설</span>
          </Link>
          {/* 휴대폰: 계정 링크를 위쪽에 */}
          <Link href="/account" className="ml-auto rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 md:hidden">
            {user.profile.name}
          </Link>
          <div className="md:hidden">
            <LogoutButton />
          </div>
        </div>
        <Link
          href={cta.href}
          className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 md:flex"
        >
          <span aria-hidden="true">＋</span>
          {cta.label}
        </Link>
        <SideNav groups={navFor(role)} />
        <div className="mt-auto hidden border-t border-slate-200 px-1.5 pt-3.5 md:block">
          <Link href="/account" className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-slate-50" title="내 계정">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
              {user.profile.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{user.profile.name}</span>
              <span className="block text-xs text-slate-500">
                {ROLE_LABEL[role]}
                {isLearner && balance != null && ` · 이용권 ${balance}회`}
              </span>
            </span>
          </Link>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={`${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto w-full flex-1 px-4 py-6 md:px-8 md:py-8`}>{children}</main>
        <VisitTracker />
        <footer className="no-print border-t border-slate-100 py-5 text-center text-xs text-slate-400">
          <Link href="/terms" className="hover:underline">
            이용약관
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="font-semibold text-slate-500 hover:underline">
            개인정보처리방침
          </Link>
        </footer>
      </div>
    </div>
  );
}
