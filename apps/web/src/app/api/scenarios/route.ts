/**
 * ===== 쉬운 설명 =====
 * 무엇: 새 시나리오를 저장하는 서버 창구(초안 상태로).
 * 언제: 편집기의 '만들기'.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { ScenarioContentSchema } from "@inhub/shared";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/** 시나리오 생성 (버전 1, 초안 상태) */
export async function POST(req: Request) {
  try {
    const u = await requireApiUser(["admin"]);
    const parsed = ScenarioContentSchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new HttpError(400, `입력값 오류: ${i.path.join(".")} — ${i.message}`);
    }
    const c = parsed.data;
    const db = adminClient();
    const { data, error } = await db
      .from("scenarios")
      .insert({ title: c.title, industry: c.industry, type: c.type, difficulty: c.difficulty, status: "draft", current_version: 1 })
      .select("id")
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    const { error: e2 } = await db.from("scenario_versions").insert({ scenario_id: id, version: 1, content: c, created_by: u.id });
    if (e2) throw e2;
    await audit(u.id, "scenario_create", id);
    return Response.json({ id });
  } catch (e) {
    return apiError(e);
  }
}
