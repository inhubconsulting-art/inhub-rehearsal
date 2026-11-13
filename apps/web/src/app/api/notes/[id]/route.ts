/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 코멘트(점수 보정 포함) 수정·삭제 창구.
 * 언제: 강사용 대화 상세 화면의 코멘트 옆 '수정'·'삭제'.
 * 리뷰 포인트: 내가 쓴 코멘트만 고치거나 지울 수 있습니다. 운영 관리자는 모든 코멘트를 고칠 수 있습니다.
 *         점수 보정을 지우면 리포트 점수는 그 전 보정값(없으면 AI 점수)으로 돌아갑니다.
 * =====================
 */
import { z } from "zod";
import { apiError, assertCohortStaff, audit, HttpError, requireApiUser, type CurrentUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  comment: z.string().trim().max(2000).optional().nullable(),
  scoreOverride: z.number().min(0).max(100).optional().nullable(),
});

/** 코멘트를 찾고, 이 사람이 고칠 수 있는지 확인합니다. */
async function loadEditable(u: CurrentUser, noteId: string) {
  const db = adminClient();
  const { data } = await db
    .from("instructor_notes")
    .select("id, author_id, evaluation_id, evaluations(sessions(cohort_id))")
    .eq("id", noteId)
    .maybeSingle();
  if (!data) throw new HttpError(404, "코멘트를 찾을 수 없습니다.");
  const note = data as unknown as { id: string; author_id: string | null; evaluations: { sessions: { cohort_id: string } } };
  await assertCohortStaff(u, note.evaluations.sessions.cohort_id);
  if (u.profile.role !== "admin" && note.author_id !== u.id) throw new HttpError(403, "내가 쓴 코멘트만 수정·삭제할 수 있습니다.");
  return note;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await loadEditable(u, id);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "입력값을 확인해 주세요.");
    if (!b.data.comment && b.data.scoreOverride == null) throw new HttpError(400, "코멘트나 점수 중 하나는 있어야 합니다. 모두 지우려면 삭제를 눌러 주세요.");
    const { error } = await adminClient()
      .from("instructor_notes")
      .update({ comment: b.data.comment || null, score_override: b.data.scoreOverride ?? null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await audit(u.id, "evaluation_note_update", id, b.data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await loadEditable(u, id);
    const { error } = await adminClient().from("instructor_notes").delete().eq("id", id);
    if (error) throw error;
    await audit(u.id, "evaluation_note_delete", id);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
