/**
 * ===== 쉬운 설명 =====
 * 무엇: 표현 목록의 표현 하나를 켜고 끄거나(PATCH) 지우는(DELETE) 서버 창구.
 * 언제: 관리자 → 표현 목록 화면에서 표현을 누르거나 ×를 눌렀을 때.
 * 리뷰 포인트: 관리자만 쓸 수 있습니다. '끄기'는 기록을 남긴 채 분석에서만 빼고, '삭제'는 목록에서 완전히 지웁니다.
 * =====================
 */
import { z } from "zod";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({ active: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) throw new HttpError(400, "입력값을 확인해 주세요.");
    const { data, error } = await adminClient()
      .from("phrase_lexicon")
      .update({ active: b.data.active })
      .eq("id", id)
      .select("category, phrase")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "표현을 찾지 못했어요.");
    await audit(u.id, b.data.active ? "lexicon_enable" : "lexicon_disable", id, data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const { data, error } = await adminClient().from("phrase_lexicon").delete().eq("id", id).select("category, phrase").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "표현을 찾지 못했어요.");
    await audit(u.id, "lexicon_delete", id, data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
