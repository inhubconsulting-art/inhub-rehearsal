/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트 화면에 필요한 모든 데이터(대화, 평가, 강사 코멘트, 추천 시나리오)를 한 번에 모읍니다. 볼 권한도 여기서
 *     확인합니다.
 * 언제: 수강생 리포트, 강사의 대화 상세, 일괄 인쇄 화면.
 * 리뷰 포인트: 본인 또는 담당 강사·관리자만 볼 수 있는지, 강사가 점수를 보정하면 보정 점수가 우선 표시되는지 확인하세요.
 * =====================
 */
import "server-only";
import {
  type CohortRow,
  type EvaluationResult,
  type EvaluationRow,
  type InstructorNoteRow,
  type MessageRow,
  type ScenarioContent,
  type SessionRow,
} from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";
import { getCohort, getCohortScenarios, getMessages, loadScenarioContent } from "@/lib/domain";
import { HttpError, isStaff, type CurrentUser } from "@/lib/auth";

export interface ReportData {
  session: SessionRow;
  cohort: CohortRow;
  content: ScenarioContent;
  messages: MessageRow[];
  evaluation: (EvaluationRow & { result: EvaluationResult }) | null;
  notes: (InstructorNoteRow & { author_name: string })[];
  learnerName: string;
  nextScenario: { id: string; title: string } | null;
}

/** 리포트에 필요한 데이터 일괄 조회 (본인 또는 담당 강사·관리자만) */
export async function loadReport(u: CurrentUser, sessionId: string): Promise<ReportData> {
  const db = adminClient();
  const { data: s } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!s) throw new HttpError(404, "대화를 찾을 수 없습니다.");
  const session = s as SessionRow;
  const cohort = await getCohort(session.cohort_id);
  const allowed =
    session.user_id === u.id || u.profile.role === "admin" || (isStaff(u) && cohort.instructor_id === u.id);
  if (!allowed) throw new HttpError(403, "볼 수 있는 권한이 없습니다.");

  const [content, messages, evRes, profRes] = await Promise.all([
    loadScenarioContent(session.scenario_id, session.scenario_version),
    getMessages(session.id),
    db.from("evaluations").select("*").eq("session_id", session.id).maybeSingle(),
    db.from("profiles").select("name").eq("id", session.user_id).maybeSingle(),
  ]);
  const evaluation = (evRes.data as ReportData["evaluation"]) ?? null;

  let notes: ReportData["notes"] = [];
  if (evaluation) {
    const { data } = await db
      .from("instructor_notes")
      .select("*, profiles(name)")
      .eq("evaluation_id", evaluation.id)
      .order("created_at");
    notes = ((data ?? []) as (InstructorNoteRow & { profiles: { name: string } | null })[]).map((n) => ({
      ...n,
      author_name: n.profiles?.name ?? "강사",
    }));
  }

  // 다음 연습 추천 (PRD 6.2-6): 추천 역량을 루브릭에 담은 다른 시나리오
  let nextScenario: ReportData["nextScenario"] = null;
  if (evaluation) {
    const target = evaluation.result.recommendation.competency;
    const others = (await getCohortScenarios(cohort.id)).filter((c) => c.scenario_id !== session.scenario_id);
    for (const cs of others) {
      const c = await loadScenarioContent(cs.scenario_id, cs.scenario_version);
      if (c.rubric.items.some((r) => r.competency === target)) {
        nextScenario = { id: cs.scenario_id, title: c.title };
        break;
      }
    }
  }

  return {
    session,
    cohort,
    content,
    messages,
    evaluation,
    notes,
    learnerName: (profRes.data as { name: string } | null)?.name ?? "",
    nextScenario,
  };
}

/** 강사 점수 보정이 있으면 최신 값을 반영한 점수 */
export function effectiveScore(r: ReportData): number | null {
  if (!r.evaluation) return null;
  const override = [...r.notes].reverse().find((n) => n.score_override != null);
  return override ? Number(override.score_override) : Number(r.evaluation.total_score);
}
