/**
 * ===== 쉬운 설명 =====
 * 무엇: 교육 차수를 바꾸는 서버 창구.
 *  - 실습 시작·일시정지·종료, 공지 (대시보드 상단)
 *  - 차수 설정 수정: 이름·일시·강사·대화 방식·제한 시간·비용 상한·순서 해금·시나리오 구성 ('설정' 화면)
 *  - 보관 / 보관 해제
 * 실습을 종료하면 진행 중인 대화를 모두 끝내고 평가로 넘깁니다.
 * 리뷰 포인트:
 *  - 이미 대화 기록이 있는 시나리오는 차수에서 뺄 수 없습니다 (기록·통계가 깨지지 않게).
 *  - 새로 추가한 시나리오는 '지금 공개된 최신 버전'으로 고정되고, 원래 있던 시나리오의 버전은 그대로 유지됩니다.
 *  - 보관은 '종료' 상태인 차수만 할 수 있습니다.
 * =====================
 */
import { z } from "zod";
import type { SessionRow } from "@inhub/shared";
import { apiError, assertCohortStaff, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { endSession } from "@/lib/domain";

const Body = z.object({
  status: z.enum(["ready", "running", "paused", "ended"]).optional(),
  announcement: z.string().max(500).nullable().optional(),
  archived: z.boolean().optional(),
  // ↓ 설정 수정 ('설정' 화면에서 한꺼번에 보냄)
  title: z.string().trim().min(1, "차수 이름을 입력하세요.").optional(),
  courseName: z.string().trim().optional().nullable(),
  clientName: z.string().trim().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  instructorId: z.string().uuid().optional().nullable(),
  allowedModes: z.array(z.enum(["text", "voice"])).min(1, "대화 방식을 1개 이상 선택하세요.").optional(),
  timeLimitSec: z.number().int().min(60).max(3600).optional().nullable(),
  sequential: z.boolean().optional(),
  budgetUsd: z.number().positive().optional().nullable(),
  scenarios: z
    .array(z.object({ scenarioId: z.string().uuid(), required: z.boolean().default(true) }))
    .min(1, "시나리오를 1개 이상 선택하세요.")
    .optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await assertCohortStaff(u, id);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const b = parsed.data;
    const db = adminClient();

    const { data: current } = await db.from("cohorts").select("status, archived_at").eq("id", id).maybeSingle();
    if (!current) throw new HttpError(404, "교육 차수를 찾을 수 없습니다.");
    const cur = current as { status: string; archived_at: string | null };

    const patch: Record<string, unknown> = {};
    if (b.status) patch.status = b.status;
    if (b.announcement !== undefined) patch.announcement = b.announcement?.trim() || null;
    if (b.archived !== undefined) {
      if (b.archived && (b.status ?? cur.status) !== "ended") throw new HttpError(400, "실습을 종료한 뒤에 보관할 수 있습니다.");
      patch.archived_at = b.archived ? new Date().toISOString() : null;
    }
    if (b.status && b.status !== "ended" && cur.archived_at) patch.archived_at = null; // 다시 열면 보관 해제
    if (b.title !== undefined) patch.title = b.title;
    if (b.courseName !== undefined) patch.course_name = b.courseName || null;
    if (b.clientName !== undefined) patch.client_name = b.clientName || null;
    if (b.startsAt !== undefined) patch.starts_at = b.startsAt || null;
    if (b.instructorId !== undefined && u.profile.role === "admin" && b.instructorId) patch.instructor_id = b.instructorId;
    if (b.allowedModes) patch.allowed_modes = b.allowedModes;
    if (b.timeLimitSec !== undefined) patch.time_limit_sec = b.timeLimitSec ?? null;
    if (b.sequential !== undefined) patch.sequential = b.sequential;
    if (b.budgetUsd !== undefined) patch.budget_usd = b.budgetUsd ?? null;

    // ── 시나리오 구성 변경 ──
    if (b.scenarios) await replaceScenarios(id, b.scenarios);

    if (Object.keys(patch).length > 0) {
      const { error } = await db.from("cohorts").update(patch).eq("id", id);
      if (error) throw error;
    }

    // 실습 종료 시 진행 중인 대화를 모두 마무리하고 평가로 넘김
    if (b.status === "ended") {
      const { data } = await db.from("sessions").select("*").eq("cohort_id", id).eq("status", "active");
      for (const s of (data ?? []) as SessionRow[]) await endSession(s, "time_limit");
    }
    await audit(u.id, b.scenarios || b.title !== undefined ? "cohort_settings" : "cohort_update", id, { ...patch, scenarios: b.scenarios?.length });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/** 차수의 시나리오 목록을 새 목록으로 바꿉니다. (대화 기록이 있는 시나리오는 빼지 못함) */
async function replaceScenarios(cohortId: string, list: { scenarioId: string; required: boolean }[]) {
  const db = adminClient();
  const ids = list.map((s) => s.scenarioId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "같은 시나리오가 두 번 들어 있습니다.");

  const { data: existingRows } = await db.from("cohort_scenarios").select("scenario_id, scenario_version").eq("cohort_id", cohortId);
  const existing = new Map(
    ((existingRows ?? []) as { scenario_id: string; scenario_version: number }[]).map((r) => [r.scenario_id, r.scenario_version]),
  );

  // 빼려는 시나리오 중 대화 기록이 있는 것 확인
  const removed = [...existing.keys()].filter((sid) => !ids.includes(sid));
  if (removed.length) {
    const { data: used } = await db.from("sessions").select("scenario_id").eq("cohort_id", cohortId).in("scenario_id", removed).limit(1);
    if ((used ?? []).length) throw new HttpError(400, "이미 대화 기록이 있는 시나리오는 차수에서 뺄 수 없습니다.");
  }

  // 새로 추가하는 시나리오는 공개된 최신 버전으로 고정
  const added = ids.filter((sid) => !existing.has(sid));
  const latest = new Map<string, number>();
  if (added.length) {
    const { data: scen } = await db.from("scenarios").select("id, current_version, status").in("id", added);
    for (const s of (scen ?? []) as { id: string; current_version: number; status: string }[]) {
      if (s.status !== "published") throw new HttpError(400, "공개되지 않은 시나리오가 포함되어 있습니다.");
      latest.set(s.id, s.current_version);
    }
    if (latest.size !== added.length) throw new HttpError(400, "존재하지 않는 시나리오가 포함되어 있습니다.");
  }

  if (removed.length) {
    const { error } = await db.from("cohort_scenarios").delete().eq("cohort_id", cohortId).in("scenario_id", removed);
    if (error) throw error;
  }
  const rows = list.map((s, i) => ({
    cohort_id: cohortId,
    scenario_id: s.scenarioId,
    scenario_version: existing.get(s.scenarioId) ?? latest.get(s.scenarioId)!,
    position: i,
    required: s.required,
  }));
  const { error } = await db.from("cohort_scenarios").upsert(rows, { onConflict: "cohort_id,scenario_id" });
  if (error) throw error;
}
