/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 한 명의 시나리오별 진행 현황(시도 횟수, 완료 여부, 최고 점수, 잠김 여부)을 계산합니다.
 * 언제: 수강생 시나리오 목록 화면, 대화 시작 API.
 * 리뷰 포인트: '순서대로 해금' 설정일 때 필수 시나리오를 끝내야 다음이 열리는 규칙(PRD L-11)이 맞는지 확인하세요.
 * =====================
 */
import "server-only";
import type { CohortScenarioRow } from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";

export interface ScenarioProgress {
  scenarioId: string;
  attempts: number;
  completed: number;
  bestScore: number | null;
  lastSessionId: string | null;
  locked: boolean;
}

/** 수강생의 차수 내 시나리오별 진행 현황 (순차 해금 포함, PRD L-11) */
export async function getLearnerProgress(
  cohortId: string,
  userId: string,
  cohortScenarios: CohortScenarioRow[],
  sequential: boolean,
): Promise<Map<string, ScenarioProgress>> {
  const db = adminClient();
  const { data: sessions } = await db
    .from("sessions")
    .select("id, scenario_id, status, started_at, evaluations(total_score)")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  const map = new Map<string, ScenarioProgress>();
  for (const cs of cohortScenarios) {
    map.set(cs.scenario_id, {
      scenarioId: cs.scenario_id,
      attempts: 0,
      completed: 0,
      bestScore: null,
      lastSessionId: null,
      locked: false,
    });
  }
  type Row = { id: string; scenario_id: string; status: string; evaluations: { total_score: number }[] | { total_score: number } | null };
  for (const s of (sessions ?? []) as Row[]) {
    const p = map.get(s.scenario_id);
    if (!p) continue;
    p.attempts += 1;
    if (!p.lastSessionId) p.lastSessionId = s.id;
    if (s.status !== "active") p.completed += 1;
    const ev = Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations;
    if (ev && (p.bestScore == null || Number(ev.total_score) > p.bestScore)) p.bestScore = Number(ev.total_score);
  }

  // 쉬운 설명: '순서대로 해금'이면, 앞의 필수 시나리오를 한 번이라도 끝내야 다음 시나리오가 열립니다.
  if (sequential) {
    let blocked = false;
    for (const cs of [...cohortScenarios].sort((a, b) => a.position - b.position)) {
      const p = map.get(cs.scenario_id)!;
      p.locked = blocked;
      if (cs.required && p.completed === 0) blocked = true;
    }
  }
  return map;
}
