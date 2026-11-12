/**
 * ===== 쉬운 설명 =====
 * 무엇: 교육 차수를 저장하는 서버 창구. 입장 코드를 만들고, 선택한 시나리오의 '현재 버전'을 고정해 둡니다.
 * 언제: 교육 차수 만들기 양식에서 저장할 때.
 * 리뷰 포인트: 버전 고정 덕분에 교육 도중 관리자가 시나리오를 고쳐도 진행 중인 교육은 바뀌지 않습니다(PRD S-01).
 * =====================
 */
import { z } from "zod";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { generateJoinCode } from "@/lib/domain";

const Body = z.object({
  title: z.string().trim().min(1),
  courseName: z.string().trim().optional().nullable(),
  clientName: z.string().trim().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  instructorId: z.string().uuid().optional().nullable(),
  allowedModes: z.array(z.enum(["text", "voice"])).min(1),
  timeLimitSec: z.number().int().min(60).max(3600).optional().nullable(),
  sequential: z.boolean().default(false),
  budgetUsd: z.number().positive().optional().nullable(),
  scenarios: z
    .array(z.object({ scenarioId: z.string().uuid(), required: z.boolean().default(true) }))
    .min(1, "시나리오를 1개 이상 선택하세요."),
});

/** 교육 차수 생성 (PRD A-01, A-02) */
export async function POST(req: Request) {
  try {
    const u = await requireApiUser(["admin", "instructor"]);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const b = parsed.data;
    const db = adminClient();

    // 배정 시점의 시나리오 버전을 고정 (PRD S-01)
    const { data: scen } = await db
      .from("scenarios")
      .select("id, current_version, status")
      .in("id", b.scenarios.map((s) => s.scenarioId));
    const versions = new Map(((scen ?? []) as { id: string; current_version: number; status: string }[]).map((s) => [s.id, s]));
    for (const s of b.scenarios) {
      const v = versions.get(s.scenarioId);
      if (!v) throw new HttpError(400, "존재하지 않는 시나리오가 포함되어 있습니다.");
      if (v.status !== "published") throw new HttpError(400, "공개되지 않은 시나리오가 포함되어 있습니다.");
    }

    // 쉬운 설명: 입장 코드가 다른 교육과 겹치지 않을 때까지 다시 만듭니다.
    let joinCode = generateJoinCode();
    for (let i = 0; i < 5; i++) {
      const { data } = await db.from("cohorts").select("id").eq("join_code", joinCode).maybeSingle();
      if (!data) break;
      joinCode = generateJoinCode();
    }

    const { data: cohort, error } = await db
      .from("cohorts")
      .insert({
        title: b.title,
        course_name: b.courseName || null,
        client_name: b.clientName || null,
        starts_at: b.startsAt || null,
        instructor_id: u.profile.role === "admin" ? b.instructorId || u.id : u.id,
        join_code: joinCode,
        allowed_modes: b.allowedModes,
        time_limit_sec: b.timeLimitSec ?? null,
        sequential: b.sequential,
        budget_usd: b.budgetUsd ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const cohortId = (cohort as { id: string }).id;

    const { error: e2 } = await db.from("cohort_scenarios").insert(
      b.scenarios.map((s, i) => ({
        cohort_id: cohortId,
        scenario_id: s.scenarioId,
        // 쉬운 설명: 지금 시점의 시나리오 버전으로 고정합니다.
        scenario_version: versions.get(s.scenarioId)!.current_version,
        position: i,
        required: s.required,
      })),
    );
    if (e2) throw e2;
    await audit(u.id, "cohort_create", cohortId);
    return Response.json({ cohortId, joinCode });
  } catch (e) {
    return apiError(e);
  }
}
