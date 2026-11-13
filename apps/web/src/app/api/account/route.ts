/**
 * ===== 쉬운 설명 =====
 * 무엇: 회원 탈퇴 API. 로그인한 수강생 본인의 계정과 연습 기록(대화·리포트)을 모두 지웁니다.
 * 언제: '내 계정' 화면에서 탈퇴 확인 후.
 * 리뷰 포인트:
 *  - 강사·관리자 계정은 교육 운영 기록과 얽혀 있어 스스로 탈퇴할 수 없습니다(다른 관리자에게 역할 변경 요청 후 탈퇴).
 *  - 탈퇴하면 그 수강생은 강사 대시보드·Excel·통계에서도 사라집니다. 되돌릴 수 없습니다.
 * =====================
 */
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  try {
    const u = await requireApiUser();
    if (u.profile.role !== "learner") {
      throw new HttpError(403, "강사·관리자 계정은 직접 탈퇴할 수 없습니다. 다른 관리자에게 요청해 주세요.");
    }
    // 쉬운 설명: 로그인 계정을 지우면 프로필 → 참여 기록 → 대화 → 리포트가 차례로 함께 지워집니다.
    const { error } = await adminClient().auth.admin.deleteUser(u.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
