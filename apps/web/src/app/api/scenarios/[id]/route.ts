/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 저장(항상 새 버전으로)과 공개·보관 상태 변경.
 * 언제: 편집기의 '새 버전으로 저장', '공개하기', '보관하기'.
 * 리뷰 포인트: 저장할 때 덮어쓰지 않고 새 버전을 쌓는다는 점이 핵심입니다(PRD S-01).
 * =====================
 */
import { z } from "zod";
import { ScenarioContentSchema } from "@inhub/shared";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/**
 * 시나리오 저장 = 새 버전 추가 (PRD S-01).
 * 이미 차수에 배정된 버전은 그대로 남으므로 진행 중인 교육에 영향이 없다.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const parsed = ScenarioContentSchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new HttpError(400, `입력값 오류: ${i.path.join(".")} — ${i.message}`);
    }
    const c = parsed.data;
    const db = adminClient();
    const { data: s } = await db.from("scenarios").select("current_version").eq("id", id).maybeSingle();
    if (!s) throw new HttpError(404, "시나리오를 찾을 수 없습니다.");
    const next = (s as { current_version: number }).current_version + 1;
    const { error } = await db.from("scenario_versions").insert({ scenario_id: id, version: next, content: c, created_by: u.id });
    if (error) throw error;
    await db
      .from("scenarios")
      .update({ title: c.title, industry: c.industry, type: c.type, difficulty: c.difficulty, current_version: next })
      .eq("id", id);
    await audit(u.id, "scenario_update", id, { version: next });
    return Response.json({ version: next });
  } catch (e) {
    return apiError(e);
  }
}

const Patch = z.object({ status: z.enum(["draft", "published", "archived"]) });

/** 공개/초안/보관 상태 변경 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin"]);
    const b = Patch.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "상태값이 올바르지 않습니다.");
    const { error } = await adminClient().from("scenarios").update({ status: b.data.status }).eq("id", id);
    if (error) throw error;
    await audit(u.id, "scenario_status", id, b.data);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
