/**
 * ===== 쉬운 설명 =====
 * 무엇: 테스트 플레이. 관리자 전용 '미리보기' 교육 차수를 만들어 바로 대화를 시작합니다. 미리보기는 목록·통계에서 빠집니다.
 * 언제: 편집기의 '테스트 (텍스트/음성)'.
 * 리뷰 포인트: 테스트는 '저장된 현재 버전'으로 진행되므로, 고친 뒤에는 먼저 저장해야 합니다.
 * =====================
 */
import { z } from "zod";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { generateJoinCode, loadScenarioContent } from "@/lib/domain";

const Body = z.object({ mode: z.enum(["text", "voice"]).default("text") });

/**
 * 테스트 플레이 (PRD S-02): 관리자 전용 '미리보기' 차수를 만들어 현재 버전으로 대화를 시작한다.
 * 미리보기 차수는 client_name = '__preview__' 로 구분되어 목록·통계에서 제외된다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const b = Body.safeParse(await req.json().catch(() => ({})));
    const mode = b.success ? b.data.mode : "text";
    const db = adminClient();
    const { data: s } = await db.from("scenarios").select("current_version").eq("id", id).maybeSingle();
    if (!s) throw new HttpError(404, "시나리오를 찾을 수 없습니다.");
    const version = (s as { current_version: number }).current_version;
    const content = await loadScenarioContent(id, version);

    const { data: cohort, error } = await db
      .from("cohorts")
      .insert({
        title: `[미리보기] ${content.title} v${version}`,
        client_name: "__preview__",
        instructor_id: u.id,
        join_code: `P${generateJoinCode()}`,
        status: "running",
        allowed_modes: ["text", "voice"],
      })
      .select("id")
      .single();
    if (error) throw error;
    const cohortId = (cohort as { id: string }).id;
    await db.from("cohort_scenarios").insert({ cohort_id: cohortId, scenario_id: id, scenario_version: version, position: 0 });
    const { data: enr } = await db.from("enrollments").insert({ cohort_id: cohortId, user_id: u.id }).select("id").single();
    const { data: sess, error: e3 } = await db
      .from("sessions")
      .insert({
        cohort_id: cohortId,
        enrollment_id: (enr as { id: string }).id,
        user_id: u.id,
        scenario_id: id,
        scenario_version: version,
        mode,
        current_emotion: content.persona.initialEmotion,
        peak_emotion: content.persona.initialEmotion,
      })
      .select("id")
      .single();
    if (e3) throw e3;
    return Response.json({ sessionId: (sess as { id: string }).id });
  } catch (e) {
    return apiError(e);
  }
}
