/**
 * ===== 쉬운 설명 =====
 * 무엇: 교육 차수 '복제'. 설정과 시나리오 구성을 그대로 복사한 새 차수를 만듭니다.
 * 언제: 대시보드 '복제' 버튼. 복제 후 바로 '설정' 화면으로 가서 이름·일시를 고치면 됩니다.
 * 리뷰 포인트:
 *  - 새 입장 코드가 만들어지고, 상태는 '준비', 수강생·대화 기록·공지는 복사하지 않습니다.
 *  - 시나리오는 지금 공개된 최신 버전으로 바뀝니다(그사이 시나리오를 다듬었다면 반영). 공개가 내려간 시나리오는 원래 버전을 씁니다.
 * =====================
 */
import type { CohortRow } from "@inhub/shared";
import { apiError, assertCohortStaff, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { generateJoinCode } from "@/lib/domain";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await assertCohortStaff(u, id);
    const db = adminClient();

    const { data: src } = await db.from("cohorts").select("*").eq("id", id).maybeSingle();
    if (!src) throw new HttpError(404, "교육 차수를 찾을 수 없습니다.");
    const c = src as CohortRow;
    const { data: csRows } = await db
      .from("cohort_scenarios")
      .select("scenario_id, scenario_version, position, required, scenarios(current_version, status)")
      .eq("cohort_id", id)
      .order("position");
    const cs = (csRows ?? []) as unknown as {
      scenario_id: string;
      scenario_version: number;
      position: number;
      required: boolean;
      scenarios: { current_version: number; status: string } | null;
    }[];

    let joinCode = generateJoinCode();
    for (let i = 0; i < 5; i++) {
      const { data } = await db.from("cohorts").select("id").eq("join_code", joinCode).maybeSingle();
      if (!data) break;
      joinCode = generateJoinCode();
    }

    const { data: created, error } = await db
      .from("cohorts")
      .insert({
        title: `${c.title} (복사본)`,
        course_name: c.course_name,
        client_name: c.client_name,
        starts_at: null,
        instructor_id: u.profile.role === "admin" ? c.instructor_id ?? u.id : u.id,
        join_code: joinCode,
        allowed_modes: c.allowed_modes,
        time_limit_sec: c.time_limit_sec,
        sequential: c.sequential,
        budget_usd: c.budget_usd,
      })
      .select("id")
      .single();
    if (error) throw error;
    const newId = (created as { id: string }).id;

    if (cs.length) {
      const { error: e2 } = await db.from("cohort_scenarios").insert(
        cs.map((r, i) => ({
          cohort_id: newId,
          scenario_id: r.scenario_id,
          scenario_version: r.scenarios?.status === "published" ? r.scenarios.current_version : r.scenario_version,
          position: i,
          required: r.required,
        })),
      );
      if (e2) throw e2;
    }
    await audit(u.id, "cohort_duplicate", newId, { from: id });
    return Response.json({ cohortId: newId });
  } catch (e) {
    return apiError(e);
  }
}
