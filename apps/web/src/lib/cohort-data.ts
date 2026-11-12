/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 대시보드용 데이터(수강생 목록, 모든 대화와 점수, 역량별 평균, AI 요약)를 한 번에 모읍니다.
 * 언제: 강사 대시보드, 수강생 상세, 발표 화면, 일괄 인쇄, Excel 내보내기.
 * 리뷰 포인트: 건너뛰어도 됩니다. 계산 결과는 화면에서 확인하는 편이 쉽습니다.
 * =====================
 */
import "server-only";
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  type CohortRow,
  type CohortSummary,
  type Competency,
  type EvaluationResult,
} from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";
import { getCohort, getCohortScenarios, loadScenarioContent } from "@/lib/domain";

export interface DashLearner {
  userId: string;
  name: string;
  organization: string | null;
  email: string | null;
  joinedAt: string;
}
export interface DashSession {
  id: string;
  userId: string;
  scenarioId: string;
  mode: "text" | "voice";
  status: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  lastActivityAt: string;
  currentEmotion: number | null;
  peakEmotion: number | null;
  turnCount: number;
  evaluationId: string | null;
  score: number | null;
  grade: string | null;
  summary: string | null;
}
export interface DashScenario {
  id: string;
  title: string;
  position: number;
  required: boolean;
}
export interface CohortDashboardData {
  cohort: CohortRow;
  learners: DashLearner[];
  sessions: DashSession[];
  scenarios: DashScenario[];
  competencyAvg: { competency: Competency; label: string; avg: number; n: number }[];
  summary: { status: string; content: CohortSummary | null; evaluationCount: number; updatedAt: string } | null;
  results: Map<string, EvaluationResult>;
}

type SessRow = {
  id: string;
  user_id: string;
  scenario_id: string;
  mode: "text" | "voice";
  status: string;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  last_activity_at: string;
  current_emotion: number | null;
  peak_emotion: number | null;
  turn_count: number;
  evaluations: { id: string; total_score: number; grade: string; result: EvaluationResult }[] | { id: string; total_score: number; grade: string; result: EvaluationResult } | null;
};

export async function loadCohortDashboard(cohortId: string): Promise<CohortDashboardData> {
  const db = adminClient();
  const cohort = await getCohort(cohortId);
  const cs = await getCohortScenarios(cohortId);
  const scenarios: DashScenario[] = await Promise.all(
    cs.map(async (c) => ({
      id: c.scenario_id,
      title: (await loadScenarioContent(c.scenario_id, c.scenario_version)).title,
      position: c.position,
      required: c.required,
    })),
  );

  const [{ data: enr }, { data: sess }, { data: notes }, { data: sum }] = await Promise.all([
    db.from("enrollments").select("user_id, joined_at, profiles(name, organization, email)").eq("cohort_id", cohortId),
    db
      .from("sessions")
      .select(
        "id, user_id, scenario_id, mode, status, started_at, ended_at, end_reason, last_activity_at, current_emotion, peak_emotion, turn_count, evaluations(id, total_score, grade, result)",
      )
      .eq("cohort_id", cohortId)
      .order("started_at", { ascending: false }),
    db.from("instructor_notes").select("evaluation_id, score_override, created_at").not("score_override", "is", null).order("created_at"),
    db.from("cohort_summaries").select("*").eq("cohort_id", cohortId).maybeSingle(),
  ]);

  const overrides = new Map<string, number>();
  for (const n of (notes ?? []) as { evaluation_id: string; score_override: number }[]) overrides.set(n.evaluation_id, Number(n.score_override));

  const learners: DashLearner[] = ((enr ?? []) as unknown as {
    user_id: string;
    joined_at: string;
    profiles: { name: string; organization: string | null; email: string | null } | null;
  }[]).map((e) => ({
    userId: e.user_id,
    name: e.profiles?.name ?? "(이름 없음)",
    organization: e.profiles?.organization ?? null,
    email: e.profiles?.email ?? null,
    joinedAt: e.joined_at,
  }));
  learners.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const results = new Map<string, EvaluationResult>();
  const sessions: DashSession[] = ((sess ?? []) as SessRow[]).map((s) => {
    const ev = Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations;
    if (ev) results.set(s.id, ev.result);
    return {
      id: s.id,
      userId: s.user_id,
      scenarioId: s.scenario_id,
      mode: s.mode,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      endReason: s.end_reason,
      lastActivityAt: s.last_activity_at,
      currentEmotion: s.current_emotion,
      peakEmotion: s.peak_emotion,
      turnCount: s.turn_count,
      evaluationId: ev?.id ?? null,
      score: ev ? (overrides.get(ev.id) ?? Number(ev.total_score)) : null,
      grade: ev?.grade ?? null,
      summary: ev?.result.oneLineSummary ?? null,
    };
  });

  const acc = new Map<Competency, { sum: number; n: number }>();
  for (const r of results.values()) {
    for (const c of r.competencyScores) {
      const a = acc.get(c.competency) ?? { sum: 0, n: 0 };
      a.sum += c.score;
      a.n += 1;
      acc.set(c.competency, a);
    }
  }
  const competencyAvg = COMPETENCIES.filter((c) => acc.has(c)).map((c) => ({
    competency: c,
    label: COMPETENCY_LABELS[c],
    avg: Math.round(acc.get(c)!.sum / acc.get(c)!.n),
    n: acc.get(c)!.n,
  }));

  const s = sum as { status: string; content: CohortSummary | null; evaluation_count: number; updated_at: string } | null;
  return {
    cohort,
    learners,
    sessions,
    scenarios,
    competencyAvg,
    summary: s ? { status: s.status, content: s.content, evaluationCount: s.evaluation_count, updatedAt: s.updated_at } : null,
    results,
  };
}
