/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인·역할(수강생/강사/관리자) 확인, 오류 응답, 감사 기록(누가 무엇을 했는지) 같은 공통 보안 기능.
 * 언제: 거의 모든 화면과 API의 첫 줄에서.
 * 리뷰 포인트: 강사는 '담당 차수만' 볼 수 있게 하는 assertCohortStaff 규칙이 PRD A-30과 맞는지 확인하세요.
 * =====================
 */
import "server-only";
import { redirect } from "next/navigation";
import type { ProfileRow, Role } from "@inhub/shared";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: ProfileRow;
}

/** 현재 로그인 사용자와 프로필. 없으면 null */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await adminClient().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? null, profile: profile as ProfileRow };
}

/** 페이지용: 로그인 + 역할 확인, 아니면 리다이렉트 */
export async function requirePageUser(roles?: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.profile.role)) redirect("/");
  return u;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** API용: 로그인 + 역할 확인, 아니면 HttpError */
export async function requireApiUser(roles?: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "로그인이 필요합니다.");
  if (roles && !roles.includes(u.profile.role)) throw new HttpError(403, "권한이 없습니다.");
  return u;
}

export function isStaff(u: CurrentUser) {
  return u.profile.role === "admin" || u.profile.role === "instructor";
}

/** 강사는 본인 차수만, 관리자는 전체 */
export async function assertCohortStaff(u: CurrentUser, cohortId: string) {
  if (u.profile.role === "admin") return;
  if (u.profile.role !== "instructor") throw new HttpError(403, "권한이 없습니다.");
  const { data } = await adminClient().from("cohorts").select("instructor_id").eq("id", cohortId).maybeSingle();
  if (!data || (data as { instructor_id: string | null }).instructor_id !== u.id) {
    throw new HttpError(403, "담당 차수가 아닙니다.");
  }
}

/** API 라우트 공통 오류 처리 */
export function apiError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
}

export async function audit(actorId: string, action: string, target?: string, detail?: unknown) {
  await adminClient().from("audit_logs").insert({ actor_id: actorId, action, target, detail: detail ?? null });
}
