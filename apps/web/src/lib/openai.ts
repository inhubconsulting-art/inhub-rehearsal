/**
 * ===== 쉬운 설명 =====
 * 무엇: OpenAI 연결과, '고객 감정 판단' 기능(텍스트 대화용).
 * 언제: 텍스트 대화에서 고객이 답할 때마다.
 * 리뷰 포인트: 판단 결과(감정 0~4, 해결 여부, 종료 의사)가 어디에 쓰이는지는 api/sessions/[id]/messages 에서
 *         이어서 보세요.
 * =====================
 */
import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildClassifierPrompt,
  clampEmotion,
  CustomerStateSchema,
  type CustomerState,
  type ScenarioContent,
  type TranscriptLine,
} from "@inhub/shared";
import { serverEnv } from "@/lib/env";

/** 추론형 모델 사고량 옵션 (OPENAI_REASONING_EFFORT 미설정 시 생략) */
export function reasoningOpt(): { reasoning?: { effort: "minimal" | "low" | "medium" | "high" } } {
  const e = process.env.OPENAI_REASONING_EFFORT as "minimal" | "low" | "medium" | "high" | undefined;
  return e ? { reasoning: { effort: e } } : {};
}

let cached: OpenAI | null = null;
export function openai() {
  if (!cached) cached = new OpenAI({ apiKey: serverEnv.openaiKey });
  return cached;
}

/** 고객 상태(감정·해결·종료 의사) 판단 */
export async function classifyCustomerState(
  content: ScenarioContent,
  lines: TranscriptLine[],
  prevEmotion: number,
): Promise<{ state: CustomerState; usage: Record<string, number> }> {
  const res = await openai().responses.parse({
    model: serverEnv.classifierModel,
    ...reasoningOpt(),
    input: buildClassifierPrompt(content, lines.slice(-12), prevEmotion),
    text: { format: zodTextFormat(CustomerStateSchema, "customer_state") },
  });
  const parsed = res.output_parsed;
  const state: CustomerState = parsed
    ? { ...parsed, emotion: clampEmotion(parsed.emotion) }
    : { emotion: prevEmotion, resolved: false, endConversation: false, reason: "판단 실패" };
  return {
    state,
    usage: {
      text_input_tokens: res.usage?.input_tokens ?? 0,
      text_output_tokens: res.usage?.output_tokens ?? 0,
    },
  };
}
