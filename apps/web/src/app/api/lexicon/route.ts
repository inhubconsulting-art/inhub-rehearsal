/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 분석에 쓰는 표현 목록(쿠션어·사과·공감·금지 표현·말버릇)에 새 표현을 추가하는 서버 창구.
 * 언제: 관리자 → 표현 목록 화면의 '추가'.
 * 리뷰 포인트: 관리자만 쓸 수 있습니다. 이미 있는 표현이면 '이미 있어요'로 안내하고, 꺼져 있던 표현이면 다시 켭니다.
 *         목록이 바뀌면 상시 서버가 몇 분 안에 지난 실습도 새 목록으로 다시 분석합니다.
 * =====================
 */
import { z } from "zod";
import { LEXICON_CATEGORIES } from "@inhub/shared";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  category: z.enum(LEXICON_CATEGORIES),
  phrase: z
    .string()
    .trim()
    .min(1, "표현을 적어 주세요.")
    .max(30, "표현은 30자까지 적을 수 있어요.")
    .refine((s) => !/[\r\n]/.test(s), "한 줄로 적어 주세요."),
});

export async function POST(req: Request) {
  try {
    const u = await requireApiUser(["admin"]);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) throw new HttpError(400, b.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const { category, phrase } = b.data;
    const db = adminClient();
    const { data: existing, error: e1 } = await db
      .from("phrase_lexicon")
      .select("id, active")
      .eq("category", category)
      .eq("phrase", phrase)
      .maybeSingle();
    if (e1) throw new HttpError(409, "DB 업데이트(SQL 실행)가 필요합니다.");
    if (existing) {
      const ex = existing as { id: string; active: boolean };
      if (ex.active) throw new HttpError(409, "이미 목록에 있는 표현이에요.");
      const { error } = await db.from("phrase_lexicon").update({ active: true }).eq("id", ex.id);
      if (error) throw error;
      await audit(u.id, "lexicon_enable", ex.id, { category, phrase });
      return Response.json({ ok: true, id: ex.id, reactivated: true });
    }
    const { data, error } = await db
      .from("phrase_lexicon")
      .insert({ category, phrase, created_by: u.id })
      .select("id")
      .single();
    if (error) throw error;
    await audit(u.id, "lexicon_add", (data as { id: string }).id, { category, phrase });
    return Response.json({ ok: true, id: (data as { id: string }).id });
  } catch (e) {
    return apiError(e);
  }
}
