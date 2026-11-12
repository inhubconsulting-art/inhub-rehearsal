/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화(세션)를 시작하는 서버 창구. 시작해도 되는지 여러 조건을 검사합니다.
 * 언제: 수강생이 '고객 연결하기'를 누를 때.
 * 리뷰 포인트: 검사 순서를 읽어 보세요: 교육 참여 여부 → 실습 중인지 → 허용된 대화 방식인지 → 배정된 시나리오인지 → 잠기지 않았는지
 *         → 진행 중인 대화가 있으면 그리로 복귀(PRD L-03).
 * =====================
 */
import { z } from "zod";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getCohort, getCohortScenarios, getEnrollment, loadScenarioContent } from "@/lib/domain";
import { getLearnerProgress } from "@/lib/progress";

const Body = z.object({
  cohortId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  mode: z.enum(["text", "voice"]),
});

/** 대화 세션 시작 */
export async function POST(req: Request) {
  try {
    const u = await requireApiUser();
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const { cohortId, scenarioId, mode } = body.data;

    const cohort = await getCohort(cohortId);
    const enrollment = await getEnrollment(cohortId, u.id);
    // 쉬운 설명: 검사 1: 이 교육에 참여했는가
    if (!enrollment) throw new HttpError(403, "이 교육에 참여하지 않았습니다.");
    // 쉬운 설명: 검사 2: 지금 실습 중인가 (강사가 시작 버튼을 눌렀는가)
    if (cohort.status !== "running") {
      throw new HttpError(400, cohort.status === "paused" ? "강사가 실습을 잠시 멈췄습니다." : "실습 시간이 아닙니다.");
    }
    // 쉬운 설명: 검사 3: 이 교육에서 허용한 대화 방식인가
    if (!cohort.allowed_modes.includes(mode)) throw new HttpError(400, "이 교육에서 허용되지 않은 대화 방식입니다.");

    const list = await getCohortScenarios(cohortId);
    const cs = list.find((x) => x.scenario_id === scenarioId);
    // 쉬운 설명: 검사 4: 이 교육에 배정된 시나리오인가
    if (!cs) throw new HttpError(404, "이 교육에 배정되지 않은 시나리오입니다.");
    const progress = await getLearnerProgress(cohortId, u.id, list, cohort.sequential);
    // 쉬운 설명: 검사 5: 순서 해금 설정에서 아직 잠긴 시나리오가 아닌가
    if (progress.get(scenarioId)?.locked) throw new HttpError(400, "앞 시나리오를 먼저 완료해 주세요.");

    const db = adminClient();
    // 진행 중인 세션이 있으면 그 세션으로 복귀 (PRD L-03)
    // 쉬운 설명: 진행 중인 대화가 있으면 새로 만들지 않고 그 대화로 돌려보냅니다 (새로고침·재접속 대비).
    const { data: active } = await db
      .from("sessions")
      .select("id")
      .eq("user_id", u.id)
      .eq("cohort_id", cohortId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (active) return Response.json({ sessionId: (active as { id: string }).id, resumed: true });

    const content = await loadScenarioContent(scenarioId, cs.scenario_version);
    const { data, error } = await db
      .from("sessions")
      .insert({
        cohort_id: cohortId,
        enrollment_id: enrollment.id,
        user_id: u.id,
        scenario_id: scenarioId,
        scenario_version: cs.scenario_version,
        mode,
        current_emotion: content.persona.initialEmotion,
        peak_emotion: content.persona.initialEmotion,
      })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ sessionId: (data as { id: string }).id, resumed: false });
  } catch (e) {
    return apiError(e);
  }
}
