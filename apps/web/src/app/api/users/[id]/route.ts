/**
 * ===== 쉬운 설명 =====
 * 무엇: 역할 변경을 저장하는 서버 창구. 본인의 관리자 권한은 해제할 수 없게 막습니다.
 * 언제: 역할 선택 상자를 바꿀 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { z } from "zod";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({ role: z.enum(["learner", "instructor", "admin"]) });

/** 역할 변경 (운영 관리자 전용) */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "역할 값이 올바르지 않습니다.");
    if (id === u.id && b.data.role !== "admin") throw new HttpError(400, "본인의 관리자 권한은 해제할 수 없습니다.");
    const { error } = await adminClient().from("profiles").update({ role: b.data.role }).eq("id", id);
    if (error) throw error;
    await audit(u.id, "user_role", id, b.data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
