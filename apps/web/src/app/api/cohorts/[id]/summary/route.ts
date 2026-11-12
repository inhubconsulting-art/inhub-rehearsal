/**
 * ===== 쉬운 설명 =====
 * 무엇: 'AI 요약 만들기' 요청을 받아 상시 서버의 대기열에 넣습니다.
 * 언제: 분석 탭의 'AI 요약 만들기'.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { apiError, assertCohortStaff, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/** 반 전체 AI 요약 생성 요청 (PRD A-21) — worker 가 대기열에서 처리 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await assertCohortStaff(u, id);
    const db = adminClient();
    await db.from("cohort_summaries").upsert({ cohort_id: id, status: "pending", updated_at: new Date().toISOString() });
    const { error } = await db.rpc("enqueue_job", { payload: { kind: "summarize_cohort", cohortId: id } });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
