/**
 * ===== 쉬운 설명 =====
 * 무엇: '연결·이관' 서버 창구. 수강생이 고객을 다른 담당자·부서로 넘길 때(예: 간호사 연결, 담당 부서 회신 예약)
 *      연결한 곳과 인계 메모를 저장하고, 실습을 '다른 담당자로 연결·이관'으로 끝냅니다(음성이면 통화도 끊음).
 * 언제: 대화 화면의 '연결·이관' 버튼에서 인계 메모를 쓰고 '연결하고 실습 마치기'를 누를 때.
 * 리뷰 포인트: 실제로 다른 사람에게 전화를 넘기지는 않습니다. 실습에서는 '고객에게 연결을 안내하는 말'과 '다음 담당자가 읽을
 *         인계 메모'까지가 상담원의 몫이고, 둘 다 리포트에서 평가합니다.
 * =====================
 */
import { z } from "zod";
import type { SessionHandoff } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { endSession, getOwnSession } from "@/lib/domain";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  target: z.string().trim().min(1, "연결할 곳을 골라 주세요.").max(60),
  memo: z.string().trim().min(10, "인계 메모를 10자 이상 써 주세요.").max(1000),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser();
    const session = await getOwnSession(u, id);
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 대화입니다.");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");

    const handoff: SessionHandoff = { status: "done", target: parsed.data.target, memo: parsed.data.memo, at: new Date().toISOString() };
    const { error } = await adminClient().from("sessions").update({ handoff }).eq("id", session.id);
    if (error) throw new HttpError(409, "연결·이관 기록을 저장하지 못했습니다. 관리자에게 DB 업데이트(SQL 실행)를 요청해 주세요.");
    await endSession(session, "transferred");
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
