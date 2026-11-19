/**
 * ===== 쉬운 설명 =====
 * 무엇: 관리자가 사용자에게 이용권을 지급(+)하거나 회수(−)하는 서버 창구.
 * 언제: 관리자 → 사용자·이용권 화면의 '지급'.
 * 리뷰 포인트: 관리자만 쓸 수 있고, 한 번에 ±100회까지입니다. 회수로 남은 횟수가 0 아래로 내려가지 않게 막습니다.
 *         누가 언제 얼마를 줬는지 운영 기록(audit)에도 남습니다.
 * =====================
 */
import { z } from "zod";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getPassBalance } from "@/lib/practice";

const Body = z.object({
  delta: z.number().int().min(-100).max(100).refine((n) => n !== 0, "0회는 지급할 수 없습니다."),
  note: z.string().trim().max(100).nullable().default(null),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) throw new HttpError(400, b.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const balance = await getPassBalance(id);
    if (balance === null) throw new HttpError(409, "DB 업데이트(SQL 실행)가 필요합니다.");
    if (balance + b.data.delta < 0) throw new HttpError(400, `남은 횟수(${balance}회)보다 많이 회수할 수 없습니다.`);
    const { error } = await adminClient()
      .from("pass_ledger")
      .insert({
        user_id: id,
        delta: b.data.delta,
        reason: b.data.delta > 0 ? "admin_grant" : "admin_revoke",
        note: b.data.note,
        created_by: u.id,
      });
    if (error) throw error;
    await audit(u.id, "pass_grant", id, b.data);
    return Response.json({ ok: true, balance: balance + b.data.delta });
  } catch (e) {
    return apiError(e);
  }
}
