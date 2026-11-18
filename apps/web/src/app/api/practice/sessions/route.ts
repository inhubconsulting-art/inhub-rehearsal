/**
 * ===== 쉬운 설명 =====
 * 무엇: 개인 연습을 시작하는 서버 창구. 교육 코드 없이 '연습하기'에서 고른 시나리오로 대화를 만듭니다.
 * 언제: 연습하기 → 시나리오 → '시작 · 이용권 1회 차감'을 누를 때.
 * 리뷰 포인트: 검사 순서 → 개인 연습에 공개된 시나리오인지 → 진행 중인 개인 연습이 있으면 그리로 복귀(차감 없음)
 *         → 이용권 1회 차감(없으면 안내) → 대화 만들기 → 만들기에 실패하면 1회 돌려줌.
 *         중간에 끝내도 이미 차감된 1회는 돌려주지 않습니다(AI 비용 발생).
 * =====================
 */
import { z } from "zod";
import type { ProfileSnapshot } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { loadScenarioContent } from "@/lib/domain";
import { requirePracticeCohortId } from "@/lib/practice";

const Body = z.object({ scenarioId: z.string().uuid(), mode: z.enum(["text", "voice"]) });

export async function POST(req: Request) {
  try {
    const u = await requireApiUser();
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const { scenarioId, mode } = body.data;
    const db = adminClient();
    const cohortId = await requirePracticeCohortId();

    // 쉬운 설명: 검사 1: 개인 연습에 공개된(게시됨 + 공개 표시) 시나리오인가
    const { data: sc } = await db.from("scenarios").select("current_version, status, practice_public").eq("id", scenarioId).maybeSingle();
    const s = sc as { current_version: number; status: string; practice_public: boolean } | null;
    if (!s || s.status !== "published" || !s.practice_public) throw new HttpError(404, "개인 연습으로 할 수 없는 시나리오입니다.");

    // 쉬운 설명: 진행 중인 개인 연습이 있으면 새로 만들지 않고 돌려보냄 (새로고침·재접속, 차감 없음)
    const { data: active } = await db
      .from("sessions")
      .select("id")
      .eq("user_id", u.id)
      .eq("cohort_id", cohortId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (active) return Response.json({ sessionId: (active as { id: string }).id, resumed: true });

    const content = await loadScenarioContent(scenarioId, s.current_version);

    // 쉬운 설명: 이용권 1회 차감 (동시에 두 번 눌러도 한 번씩 처리)
    const { data: ledgerId, error: passErr } = await db.rpc("consume_pass", { p_user: u.id, p_note: content.title });
    if (passErr) {
      if (/NO_PASS/.test(passErr.message)) throw new HttpError(402, "남은 이용권이 없어요. 이용권 화면에서 확인해 주세요.");
      throw passErr;
    }

    try {
      // 개인 연습 차수에 처음이면 참여 기록을 만듦 (그때의 프로필도 함께 기록)
      const p = u.profile;
      const snapshot: ProfileSnapshot = {
        organization: p.organization ?? null,
        department: p.department ?? null,
        industry: p.industry ?? null,
        job_category: p.job_category ?? null,
        job_id: p.job_id ?? null,
        job_custom: p.job_custom ?? null,
        career: p.career ?? null,
      };
      await db
        .from("enrollments")
        .upsert(
          { cohort_id: cohortId, user_id: u.id, consent_at: new Date().toISOString(), profile_snapshot: snapshot },
          { onConflict: "cohort_id,user_id", ignoreDuplicates: true },
        );
      const { data: enr } = await db.from("enrollments").select("id").eq("cohort_id", cohortId).eq("user_id", u.id).single();
      const { data, error } = await db
        .from("sessions")
        .insert({
          cohort_id: cohortId,
          enrollment_id: (enr as { id: string }).id,
          user_id: u.id,
          scenario_id: scenarioId,
          scenario_version: s.current_version,
          mode,
          current_emotion: content.persona.initialEmotion,
          peak_emotion: content.persona.initialEmotion,
        })
        .select("id")
        .single();
      if (error) throw error;
      const sessionId = (data as { id: string }).id;
      await db.from("pass_ledger").update({ session_id: sessionId }).eq("id", ledgerId as number);
      return Response.json({ sessionId, resumed: false });
    } catch (err) {
      // 쉬운 설명: 대화를 만들지 못했으면 차감한 1회를 돌려줍니다.
      await db.from("pass_ledger").insert({ user_id: u.id, delta: 1, reason: "refund", note: "개인 연습 시작 실패" });
      throw err;
    }
  } catch (e) {
    return apiError(e);
  }
}
