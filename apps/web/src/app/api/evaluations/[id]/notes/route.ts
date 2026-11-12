/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 코멘트·점수 보정을 저장하는 서버 창구. 고칠 때마다 새 기록으로 남겨 이력이 보존됩니다.
 * 언제: 코멘트 '저장' 버튼.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { z } from "zod";
import { apiError, assertCohortStaff, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  comment: z.string().trim().max(2000).optional().nullable(),
  scoreOverride: z.number().min(0).max(100).optional().nullable(),
});

/** 강사 코멘트·점수 보정 (PRD R-04, 수정 이력은 행 단위로 보존) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    const db = adminClient();
    const { data: ev } = await db.from("evaluations").select("id, sessions(cohort_id)").eq("id", id).maybeSingle();
    if (!ev) throw new HttpError(404, "평가를 찾을 수 없습니다.");
    const cohortId = (ev as unknown as { sessions: { cohort_id: string } }).sessions.cohort_id;
    await assertCohortStaff(u, cohortId);

    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "입력값을 확인해 주세요.");
    if (!b.data.comment && b.data.scoreOverride == null) throw new HttpError(400, "코멘트나 점수를 입력하세요.");
    const { error } = await db.from("instructor_notes").insert({
      evaluation_id: id,
      author_id: u.id,
      comment: b.data.comment || null,
      score_override: b.data.scoreOverride ?? null,
    });
    if (error) throw error;
    await audit(u.id, "evaluation_note", id, b.data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
