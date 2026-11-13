/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 첫 화면. 교육 차수 카드 목록(상태, 입장 코드, 수강생 수). 강사는 담당 차수만, 관리자는 전체가 보입니다.
 * 언제: 강사·관리자가 로그인하면 바로.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import Link from "next/link";
import type { CohortRow } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

const STATUS = {
  ready: { label: "준비", tone: "amber" },
  running: { label: "실습 중", tone: "green" },
  paused: { label: "일시정지", tone: "amber" },
  ended: { label: "종료", tone: "slate" },
} as const;

// 쉬운 설명: 목록 순서 = 실습 중 → 일시정지 → 준비 → 종료. 같은 상태끼리는 최근에 만든 순.
const ORDER = { running: 0, paused: 1, ready: 2, ended: 3 } as const;

export default async function InstructorHome({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const u = await requirePageUser(["admin", "instructor"]);
  const { view } = await searchParams;
  const showArchived = view === "archived";
  let q = adminClient()
    .from("cohorts")
    .select("*, enrollments(count), profiles:instructor_id(name)")
    .or("client_name.is.null,client_name.neq.__preview__")
    .order("created_at", { ascending: false });
  if (u.profile.role !== "admin") q = q.eq("instructor_id", u.id);
  const { data } = await q;
  const all = (data ?? []) as (CohortRow & { enrollments: { count: number }[]; profiles: { name: string } | null })[];
  const archivedCount = all.filter((c) => c.archived_at).length;
  const cohorts = all
    .filter((c) => (showArchived ? Boolean(c.archived_at) : !c.archived_at))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <AppShell user={u} wide>
      <PageHeader
        title="교육 차수"
        description={u.profile.role === "admin" ? "전체 교육 차수" : "담당 교육 차수"}
        actions={<LinkButton href="/instructor/cohorts/new">새 교육 차수</LinkButton>}
      />
      <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
        <Link
          href="/instructor"
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${!showArchived ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500"}`}
        >
          교육 차수 {all.length - archivedCount}
        </Link>
        <Link
          href="/instructor?view=archived"
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${showArchived ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500"}`}
        >
          보관됨 {archivedCount}
        </Link>
      </div>
      {cohorts.length === 0 ? (
        showArchived ? (
          <EmptyState title="보관한 차수가 없습니다.">종료한 차수의 대시보드에서 ‘보관’을 누르면 여기로 옮겨집니다.</EmptyState>
        ) : (
          <EmptyState title="아직 교육 차수가 없습니다.">‘새 교육 차수’로 시작하세요.</EmptyState>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((c) => (
            <Link key={c.id} href={`/instructor/cohorts/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <span className="font-mono text-sm text-slate-500">{c.join_code}</span>
                </div>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {[c.client_name, c.course_name].filter(Boolean).join(" · ") || "-"}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  수강생 {c.enrollments?.[0]?.count ?? 0}명
                  {c.starts_at && ` · ${fmtDate(c.starts_at)}`}
                  {u.profile.role === "admin" && c.profiles?.name && ` · 강사 ${c.profiles.name}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
