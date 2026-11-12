/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 복제(새 초안).
 * 언제: 편집기의 '복제'.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { loadScenarioContent } from "@/lib/domain";

/** 시나리오 복제 (새 초안) */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const db = adminClient();
    const { data: s } = await db.from("scenarios").select("current_version").eq("id", id).maybeSingle();
    if (!s) throw new HttpError(404, "시나리오를 찾을 수 없습니다.");
    const content = await loadScenarioContent(id, (s as { current_version: number }).current_version);
    const copy = { ...content, title: `${content.title} (복사본)` };
    const { data, error } = await db
      .from("scenarios")
      .insert({ title: copy.title, industry: copy.industry, type: copy.type, difficulty: copy.difficulty, status: "draft", current_version: 1 })
      .select("id")
      .single();
    if (error) throw error;
    const newId = (data as { id: string }).id;
    await db.from("scenario_versions").insert({ scenario_id: newId, version: 1, content: copy, created_by: u.id });
    await audit(u.id, "scenario_duplicate", newId, { from: id });
    return Response.json({ id: newId });
  } catch (e) {
    return apiError(e);
  }
}
