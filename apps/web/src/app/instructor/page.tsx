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

export default async function InstructorHome() {
  const u = await requirePageUser(["admin", "instructor"]);
  let q = adminClient()
    .from("cohorts")
    .select("*, enrollments(count), profiles:instructor_id(name)")
    .or("client_name.is.null,client_name.neq.__preview__")
    .order("created_at", { ascending: false });
  if (u.profile.role !== "admin") q = q.eq("instructor_id", u.id);
  const { data } = await q;
  const cohorts = (data ?? []) as (CohortRow & { enrollments: { count: number }[]; profiles: { name: string } | null })[];

  return (
    <AppShell user={u} wide>
      <PageHeader
        title="교육 차수"
        description={u.profile.role === "admin" ? "전체 교육 차수" : "담당 교육 차수"}
        actions={<LinkButton href="/instructor/cohorts/new">새 교육 차수</LinkButton>}
      />
      {cohorts.length === 0 ? (
        <EmptyState title="아직 교육 차수가 없습니다.">‘새 교육 차수’로 시작하세요.</EmptyState>
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
