/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생이 '대화 종료'를 누르거나 시간이 다 됐을 때 대화를 끝내는 서버 창구.
 * 언제: 대화 종료 버튼, 타이머 만료.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/auth";
import { endSession, getOwnSession } from "@/lib/domain";

const Body = z.object({
  reason: z.enum(["learner_ended", "time_limit", "error"]).default("learner_ended"),
});

/** 수강생이 대화 종료 (또는 화면 타이머 만료) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser();
    const session = await getOwnSession(u, id);
    const body = Body.safeParse(await req.json().catch(() => ({})));
    const reason = body.success ? body.data.reason : "learner_ended";
    if (session.status === "active") await endSession(session, reason);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
