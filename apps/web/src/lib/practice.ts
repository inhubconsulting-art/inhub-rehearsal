/**
 * ===== 쉬운 설명 =====
 * 무엇: 개인 연습·이용권 서버 도우미.
 *  - 개인 연습 전용 교육 차수('__practice__') 찾기, 개인 연습에 공개된 시나리오 목록
 *  - 남은 이용권 횟수, 이용권 사용 내역
 * 언제: 연습하기·이용권·홈 화면과 개인 연습 시작 창구에서.
 * 리뷰 포인트:
 *  - 교육 과정(입장 코드) 실습은 이용권과 무관합니다. 차감은 개인 연습을 시작할 때만 합니다(api/practice/sessions).
 *  - DB 준비(SQL 실행) 전이면 횟수는 null 로 돌려주고 화면은 '준비 중'으로 보여 줍니다.
 * =====================
 */
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth";

/** 목록·통계에서 숨기는 특수 교육 차수 */
export const PRACTICE_CLIENT = "__practice__";
export const PREVIEW_CLIENT = "__preview__";
export const HIDDEN_CLIENTS = [PRACTICE_CLIENT, PREVIEW_CLIENT];
export const isHiddenCohort = (clientName: string | null | undefined) => HIDDEN_CLIENTS.includes(clientName ?? "");

/** 개인 연습 전용 교육 차수 id (없으면 null) */
export async function getPracticeCohortId(): Promise<string | null> {
  const { data } = await adminClient().from("cohorts").select("id").eq("client_name", PRACTICE_CLIENT).limit(1).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function requirePracticeCohortId(): Promise<string> {
  const id = await getPracticeCohortId();
  if (!id) throw new HttpError(503, "개인 연습이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
  return id;
}

/** 남은 이용권 횟수 (DB 준비 전이면 null) */
export async function getPassBalance(userId: string): Promise<number | null> {
  const { data, error } = await adminClient().rpc("pass_balance", { p_user: userId });
  if (error) return null;
  return typeof data === "number" ? data : Number(data ?? 0);
}

/** 여러 사람의 남은 횟수 (관리자 사용자 화면용) */
export async function getPassBalances(userIds: string[]): Promise<Map<string, number> | null> {
  if (!userIds.length) return new Map();
  const { data, error } = await adminClient().from("pass_ledger").select("user_id, delta").in("user_id", userIds);
  if (error) return null;
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { user_id: string; delta: number }[]) m.set(r.user_id, (m.get(r.user_id) ?? 0) + r.delta);
  return m;
}

export interface PassLedgerRow {
  id: number;
  delta: number;
  reason: "signup_trial" | "admin_grant" | "admin_revoke" | "practice" | "refund";
  session_id: string | null;
  note: string | null;
  created_at: string;
}

export const PASS_REASON_LABELS: Record<PassLedgerRow["reason"], string> = {
  signup_trial: "가입 체험 이용권",
  admin_grant: "운영자 지급",
  admin_revoke: "운영자 회수",
  practice: "개인 연습",
  refund: "시작 실패로 돌려받음",
};

export async function getPassLedger(userId: string, limit = 50): Promise<PassLedgerRow[]> {
  const { data, error } = await adminClient()
    .from("pass_ledger")
    .select("id, delta, reason, session_id, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as PassLedgerRow[];
}

export interface PracticeScenario {
  id: string;
  title: string;
  industry: string;
  type: string;
  difficulty: string;
  current_version: number;
}

/** 개인 연습에 공개된(게시됨 + 공개 표시 켬) 시나리오 */
export async function listPracticeScenarios(): Promise<PracticeScenario[]> {
  const { data, error } = await adminClient()
    .from("scenarios")
    .select("id, title, industry, type, difficulty, current_version")
    .eq("status", "published")
    .eq("practice_public", true)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as PracticeScenario[];
}
