/**
 * ===== 쉬운 설명 =====
 * 무엇: 교육 차수 '설정' 화면. 만들 때와 같은 양식으로 이름·일시·강사·대화 방식·시간·시나리오 구성을 고칩니다.
 * 언제: 대시보드 '설정' 버튼, 또는 '복제' 직후.
 * 리뷰 포인트: 이미 대화 기록이 있는 시나리오는 🔒 표시되고 뺄 수 없습니다.
 * =====================
 */
import { redirect } from "next/navigation";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getCohort } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { LinkButton, PageHeader } from "@/components/ui";
import { CohortForm } from "@/components/instructor/CohortForm";

type Scen = { id: string; title: string; industry: string; type: string; difficulty: string };

export default async function CohortSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const db = adminClient();
  const cohort = await getCohort(id);
  const [{ data: published }, { data: assignedRows }, { data: usedRows }, { data: instructors }] = await Promise.all([
    db.from("scenarios").select("id, title, industry, type, difficulty").eq("status", "published").order("title"),
    db
      .from("cohort_scenarios")
      .select("scenario_id, required, position, scenarios(id, title, industry, type, difficulty)")
      .eq("cohort_id", id)
      .order("position"),
    db.from("sessions").select("scenario_id").eq("cohort_id", id),
    u.profile.role === "admin"
      ? db.from("profiles").select("id, name").in("role", ["instructor", "admin"]).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const assigned = (assignedRows ?? []) as unknown as { scenario_id: string; required: boolean; scenarios: Scen | null }[];

  // 목록 = 공개된 시나리오 + (공개가 내려갔어도) 이미 배정된 시나리오
  const list = new Map<string, Scen>(((published ?? []) as Scen[]).map((s) => [s.id, s]));
  for (const a of assigned) if (a.scenarios && !list.has(a.scenario_id)) list.set(a.scenario_id, a.scenarios);
  const locked = [...new Set(((usedRows ?? []) as { scenario_id: string }[]).map((r) => r.scenario_id))];

  return (
    <AppShell user={u}>
      <PageHeader
        title="차수 설정"
        description={`${cohort.title} · 입장 코드 ${cohort.join_code}`}
        actions={
          <LinkButton href={`/instructor/cohorts/${id}`} variant="secondary">
            대시보드로
          </LinkButton>
        }
      />
      <CohortForm
        scenarios={[...list.values()]}
        instructors={(instructors ?? []) as { id: string; name: string }[]}
        isAdmin={u.profile.role === "admin"}
        selfId={u.id}
        cohortId={id}
        lockedScenarioIds={locked}
        initial={{
          title: cohort.title,
          courseName: cohort.course_name ?? "",
          clientName: cohort.client_name ?? "",
          startsAt: cohort.starts_at,
          instructorId: cohort.instructor_id,
          allowedModes: cohort.allowed_modes,
          timeLimitSec: cohort.time_limit_sec,
          sequential: cohort.sequential,
          budgetUsd: cohort.budget_usd != null ? Number(cohort.budget_usd) : null,
          scenarios: assigned.map((a) => ({ scenarioId: a.scenario_id, required: a.required })),
        }}
      />
    </AppShell>
  );
}
