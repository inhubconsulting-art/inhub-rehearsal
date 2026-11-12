/**
 * ===== 쉬운 설명 =====
 * 무엇: 실습 시작·일시정지·종료와 공지를 바꾸는 서버 창구. 실습을 종료하면 진행 중인 대화를 모두 끝내고 평가로 넘깁니다.
 * 언제: 대시보드 상단 버튼과 공지 보내기.
 * 리뷰 포인트: 건너뛰어도 됩니다.
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
});

/** 실습 시작/일시정지/종료, 공지 (PRD A-03) */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await assertCohortStaff(u, id);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "입력값을 확인해 주세요.");
    const patch: Record<string, unknown> = {};
    if (parsed.data.status) patch.status = parsed.data.status;
    if (parsed.data.announcement !== undefined) patch.announcement = parsed.data.announcement?.trim() || null;

    const db = adminClient();
    const { error } = await db.from("cohorts").update(patch).eq("id", id);
    if (error) throw error;

    // 실습 종료 시 진행 중인 대화를 모두 마무리하고 평가로 넘김
    // 쉬운 설명: 실습을 종료하면 아직 대화 중인 수강생의 대화도 모두 끝내고 평가로 넘깁니다.
    if (parsed.data.status === "ended") {
      const { data } = await db.from("sessions").select("*").eq("cohort_id", id).eq("status", "active");
      for (const s of (data ?? []) as SessionRow[]) await endSession(s, "time_limit");
    }
    await audit(u.id, "cohort_update", id, patch);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
