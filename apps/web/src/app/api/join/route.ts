/**
 * ===== 쉬운 설명 =====
 * 무엇: 입장 코드로 교육 차수에 참여시키는 서버 창구. 동의 여부도 함께 기록합니다.
 * 언제: 수강생이 입장 코드 입력 후 '참여하기'를 누를 때.
 * 리뷰 포인트: 종료된 교육에는 입장할 수 없게 막는지 확인하세요.
 *         처음 입장할 때 어떻게 들어왔는지(QR·공유 주소·코드 직접 입력)를 entry_source 로 남깁니다.
 *         처음 입장할 때 그 순간의 프로필(소속·업종·직무·경력)을 profile_snapshot 으로 함께 저장합니다.
 *         나중에 이직하거나 경력이 늘어도, 이 교육의 분석은 입장 당시 기준으로 남습니다.
 * =====================
 */
import { z } from "zod";
import type { ProfileSnapshot } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  code: z.string().trim().min(4).max(12),
  consent: z.literal(true),
  /** 어떻게 들어왔는지: qr / link / code(직접 입력) */
  source: z.enum(["qr", "link", "code"]).default("code"),
});

/** 입장 코드로 교육 차수 참여 (PRD L-01, L-04) */
export async function POST(req: Request) {
  try {
    const u = await requireApiUser();
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "입장 코드와 동의 여부를 확인해 주세요.");

    const db = adminClient();
    const { data: cohort } = await db
      .from("cohorts")
      .select("id, status")
      .eq("join_code", body.data.code.toUpperCase())
      .maybeSingle();
    if (!cohort) throw new HttpError(404, "입장 코드가 올바르지 않습니다.");
    if ((cohort as { status: string }).status === "ended") throw new HttpError(400, "이미 종료된 교육입니다.");

    const cohortId = (cohort as { id: string }).id;
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
    const row = {
      cohort_id: cohortId,
      user_id: u.id,
      consent_at: new Date().toISOString(),
      profile_snapshot: snapshot,
      entry_source: body.data.source,
    };
    let { error } = await db.from("enrollments").upsert(row, { onConflict: "cohort_id,user_id", ignoreDuplicates: true });
    // 쉬운 설명: DB에 entry_source 칸이 아직 없으면(SQL 실행 전) 그 칸만 빼고 다시 저장 → 입장이 막히지 않게
    if (error && /entry_source/.test(error.message)) {
      const rest: Partial<typeof row> = { ...row };
      delete rest.entry_source;
      ({ error } = await db.from("enrollments").upsert(rest, { onConflict: "cohort_id,user_id", ignoreDuplicates: true }));
    }
    if (error) throw error;
    return Response.json({ cohortId });
  } catch (e) {
    return apiError(e);
  }
}
