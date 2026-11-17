/**
 * ===== 쉬운 설명 =====
 * 무엇: 내 프로필(이름·소속·부서·업종·직무·경력)을 저장하는 서버 창구.
 * 언제: '프로필 완성' 화면과 '내 계정'의 프로필 수정에서 '저장'을 누를 때.
 * 리뷰 포인트:
 *  - 본인 프로필만 바꿀 수 있습니다. 이메일과 권한(수강생/강사/관리자)은 여기서 바꿀 수 없습니다.
 *  - 처음 저장할 때 profile_completed_at(완성 시각)을 기록하고, 그 뒤로는 다시 안내하지 않습니다.
 * =====================
 */
import { CUSTOM_JOB_ID, findJob, ProfileAttributesSchema } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export async function PUT(req: Request) {
  try {
    const u = await requireApiUser();
    const parsed = ProfileAttributesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const v = parsed.data;
    const job = findJob(v.jobId);

    const { error } = await adminClient()
      .from("profiles")
      .update({
        name: v.name,
        organization: v.organization,
        department: v.department || null,
        industry: v.industry,
        job_category: job?.category.id ?? null,
        job_id: v.jobId,
        job_custom: v.jobId === CUSTOM_JOB_ID ? v.jobCustom : null,
        career: v.career,
        profile_completed_at: u.profile.profile_completed_at ?? new Date().toISOString(),
      })
      .eq("id", u.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
