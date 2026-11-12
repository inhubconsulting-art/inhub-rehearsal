/**
 * ===== 쉬운 설명 =====
 * 무엇: 음성 대화를 텍스트 대화로 바꾸는 서버 창구.
 * 언제: 음성 연결에 실패해 수강생이 '텍스트로 전환'을 누를 때(PRD L-23).
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { z } from "zod";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getCohort, getOwnSession, hangupCall } from "@/lib/domain";

const Body = z.object({ mode: z.literal("text") });

/** 음성 연결 실패 시 텍스트 모드로 전환 (PRD L-23) */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser();
    const session = await getOwnSession(u, id);
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 대화입니다.");
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const cohort = await getCohort(session.cohort_id);
    if (!cohort.allowed_modes.includes("text")) throw new HttpError(400, "이 교육은 텍스트 모드를 허용하지 않습니다.");
    if (session.openai_call_id) await hangupCall(session.openai_call_id).catch(() => {});
    await adminClient().from("sessions").update({ mode: "text", openai_call_id: null }).eq("id", session.id);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
