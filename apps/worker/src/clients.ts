/**
 * ===== 쉬운 설명 =====
 * 무엇: 상시 서버가 쓰는 DB·OpenAI 연결과 공통 기능(발화 저장, 대화 종료, 감정 판단 등).
 * 언제: 상시 서버 전반.
 * 리뷰 포인트: 웹앱의 lib/domain.ts 와 같은 역할입니다. 건너뛰어도 됩니다.
 * =====================
 */
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildClassifierPrompt,
  clampEmotion,
  CustomerStateSchema,
  ScenarioContentSchema,
  type CustomerState,
  type MessageRow,
  type ScenarioContent,
  type TranscriptLine,
} from "@inhub/shared";
import { env } from "./env";

export const db = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const openai = new OpenAI({ apiKey: env.openaiKey });

export async function loadScenarioContent(scenarioId: string, version: number): Promise<ScenarioContent> {
  const { data, error } = await db
    .from("scenario_versions")
    .select("content")
    .eq("scenario_id", scenarioId)
    .eq("version", version)
    .single();
  if (error) throw error;
  return ScenarioContentSchema.parse((data as { content: unknown }).content);
}

export async function getMessages(sessionId: string): Promise<MessageRow[]> {
  const { data, error } = await db.from("messages").select("*").eq("session_id", sessionId).order("seq");
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function appendMessage(sessionId: string, role: "learner" | "customer", content: string): Promise<MessageRow> {
  const { data, error } = await db.rpc("append_message", {
    p_session_id: sessionId,
    p_role: role,
    p_content: content,
    p_emotion: null,
  });
  if (error) throw error;
  return data as MessageRow;
}

export async function endSession(sessionId: string, reason: string): Promise<boolean> {
  const { data, error } = await db.rpc("end_session", { p_session_id: sessionId, p_reason: reason });
  if (error) throw error;
  return Boolean(data);
}

export async function hangupCall(callId: string) {
  await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}` },
  }).catch(() => {});
}

export async function addUsage(sessionId: string, delta: Record<string, number>) {
  const { data } = await db.from("sessions").select("usage").eq("id", sessionId).maybeSingle();
  const usage = { ...((data as { usage?: Record<string, number> } | null)?.usage ?? {}) };
  for (const [k, v] of Object.entries(delta)) usage[k] = (usage[k] ?? 0) + (Number.isFinite(v) ? v : 0);
  await db.from("sessions").update({ usage }).eq("id", sessionId);
}

export async function classifyCustomerState(
  content: ScenarioContent,
  lines: TranscriptLine[],
  prevEmotion: number,
): Promise<{ state: CustomerState; usage: Record<string, number> }> {
  const res = await openai.responses.parse({
    model: env.classifierModel,
    ...(env.reasoningEffort ? { reasoning: { effort: env.reasoningEffort } } : {}),
    input: buildClassifierPrompt(content, lines.slice(-12), prevEmotion),
    text: { format: zodTextFormat(CustomerStateSchema, "customer_state") },
  });
  const p = res.output_parsed;
  return {
    state: p
      ? { ...p, emotion: clampEmotion(p.emotion) }
      : { emotion: prevEmotion, resolved: false, endConversation: false, reason: "판단 실패" },
    usage: { text_input_tokens: res.usage?.input_tokens ?? 0, text_output_tokens: res.usage?.output_tokens ?? 0 },
  };
}
