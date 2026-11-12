/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 세션을 다루는 공통 기능 모음: 시나리오 불러오기, 발화 저장, 감정 기록, 대화 종료(+리포트 대기열 등록), 음성
 *     통화 끊기, 사용량 누적, 입장 코드 생성.
 * 언제: 대화 관련 API 대부분에서.
 * 리뷰 포인트: endSession 이 '종료 → 평가 대기열 등록 → 음성이면 통화 끊기'를 하는지, 입장 코드가 헷갈리는 글자(0/O,
 *         1/I)를 빼고 6자리로 만들어지는지 확인하세요.
 * =====================
 */
import "server-only";
import {
  ScenarioContentSchema,
  type CohortRow,
  type CohortScenarioRow,
  type EnrollmentRow,
  type MessageRow,
  type ScenarioContent,
  type SessionRow,
} from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError, type CurrentUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export async function loadScenarioContent(scenarioId: string, version: number): Promise<ScenarioContent> {
  const { data, error } = await adminClient()
    .from("scenario_versions")
    .select("content")
    .eq("scenario_id", scenarioId)
    .eq("version", version)
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "시나리오를 찾을 수 없습니다.");
  return ScenarioContentSchema.parse((data as { content: unknown }).content);
}

export async function getCohort(cohortId: string): Promise<CohortRow> {
  const { data } = await adminClient().from("cohorts").select("*").eq("id", cohortId).maybeSingle();
  if (!data) throw new HttpError(404, "교육 차수를 찾을 수 없습니다.");
  return data as CohortRow;
}

export async function getCohortScenarios(cohortId: string): Promise<CohortScenarioRow[]> {
  const { data } = await adminClient()
    .from("cohort_scenarios")
    .select("*")
    .eq("cohort_id", cohortId)
    .order("position");
  return (data ?? []) as CohortScenarioRow[];
}

export async function getEnrollment(cohortId: string, userId: string): Promise<EnrollmentRow | null> {
  const { data } = await adminClient()
    .from("enrollments")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as EnrollmentRow) ?? null;
}

/** 세션 소유자(수강생) 확인 후 세션 반환 */
export async function getOwnSession(u: CurrentUser, sessionId: string): Promise<SessionRow> {
  const { data } = await adminClient().from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!data) throw new HttpError(404, "대화를 찾을 수 없습니다.");
  const s = data as SessionRow;
  if (s.user_id !== u.id) throw new HttpError(403, "본인 대화만 이용할 수 있습니다.");
  return s;
}

export async function getMessages(sessionId: string): Promise<MessageRow[]> {
  const { data } = await adminClient()
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq");
  return (data ?? []) as MessageRow[];
}

export async function appendMessage(sessionId: string, role: "learner" | "customer", content: string) {
  const { data, error } = await adminClient().rpc("append_message", {
    p_session_id: sessionId,
    p_role: role,
    p_content: content,
    p_emotion: null,
  });
  if (error) throw error;
  return data as MessageRow;
}

export async function setCustomerEmotion(sessionId: string, emotion: number) {
  const { error } = await adminClient().rpc("set_customer_emotion", { p_session_id: sessionId, p_emotion: emotion });
  if (error) throw error;
}

/** 대화 시간 제한: 차수 설정이 있으면 우선 */
export function effectiveTimeLimit(cohort: CohortRow, content: ScenarioContent) {
  return cohort.time_limit_sec ?? content.timeLimitSec;
}

/** 세션 종료 + 평가 대기열 등록 (+ 음성 통화 끊기) */
// 쉬운 설명: 대화를 끝내는 공통 기능: DB에서 종료 처리 + 평가 대기열 등록, 음성이면 OpenAI 통화도 끊습니다.
export async function endSession(session: SessionRow, reason: string): Promise<boolean> {
  const { data, error } = await adminClient().rpc("end_session", { p_session_id: session.id, p_reason: reason });
  if (error) throw error;
  if (session.mode === "voice" && session.openai_call_id) {
    await hangupCall(session.openai_call_id).catch((e) => console.warn("hangup failed", e));
  }
  return Boolean(data);
}

export async function hangupCall(callId: string) {
  await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv.openaiKey}` },
  });
}

/** 세션 사용량 누적 (비용 추정용) */
export async function addUsage(sessionId: string, delta: Record<string, number>) {
  const { data } = await adminClient().from("sessions").select("usage").eq("id", sessionId).maybeSingle();
  const usage = { ...((data as { usage?: Record<string, number> } | null)?.usage ?? {}) };
  for (const [k, v] of Object.entries(delta)) usage[k] = (usage[k] ?? 0) + (Number.isFinite(v) ? v : 0);
  await adminClient().from("sessions").update({ usage }).eq("id", sessionId);
}

// 쉬운 설명: 입장 코드 6자리. 헷갈리는 글자(0, O, 1, I)는 뺐습니다.
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
