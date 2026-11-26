/**
 * ===== 쉬운 설명 =====
 * 무엇: OpenAI 호출 창구. 실제 호출(real)과, 인터넷 없이 흐름만 점검하는 가짜 호출(mock) 두 가지가 있습니다.
 * 언제: AI 고객·감정 판단·평가·가상 수강생이 말할 때마다.
 * 리뷰 포인트: 서비스와 똑같은 모델·옵션으로 부르는지 확인하세요.
 *   - AI 고객·감정 판단: OPENAI_CHAT_MODEL / OPENAI_CLASSIFIER_MODEL + OPENAI_REASONING_EFFORT (웹앱과 같음)
 *   - 평가: OPENAI_EVAL_MODEL, 사고량 옵션 없음 (상시 서버 jobs.ts 와 같음)
 *   - 가상 수강생: SIM_LEARNER_MODEL (없으면 OPENAI_CHAT_MODEL), SIM_REASONING_EFFORT (기본 low)
 *   429·500번대 오류는 최대 4번까지 기다렸다 다시 시도합니다.
 * =====================
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type CallKind = "customer" | "classifier" | "eval" | "learner" | "memo";

export interface LlmRequest<T = unknown> {
  kind: CallKind;
  model: string;
  instructions?: string;
  input: string | { role: "user" | "assistant"; content: string }[];
  reasoningEffort?: string | null;
  schema?: z.ZodType<T>;
  schemaName?: string;
  /** 가짜(mock) 호출이 그럴듯한 답을 만들 때 참고하는 정보. 실제 호출에서는 쓰지 않음 */
  hint?: Record<string, unknown>;
}

export interface LlmResponse<T = unknown> {
  text: string;
  parsed: T | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface Llm {
  call<T>(req: LlmRequest<T>): Promise<LlmResponse<T>>;
}

/** 추론형 모델(gpt-5·o 계열)에만 사고량 옵션을 붙임. 다른 모델에 붙이면 오류가 나기 때문 */
function reasoningFor(model: string, effort: string | null | undefined) {
  if (!effort) return {};
  if (!/^(gpt-5|o\d)/.test(model)) return {};
  return { reasoning: { effort: effort as "minimal" | "low" | "medium" | "high" } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function realLlm(apiKey: string): Llm {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
  return {
    async call<T>(req: LlmRequest<T>): Promise<LlmResponse<T>> {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const t0 = Date.now();
        try {
          if (req.schema) {
            const res = await client.responses.parse({
              model: req.model,
              ...reasoningFor(req.model, req.reasoningEffort),
              ...(req.instructions ? { instructions: req.instructions } : {}),
              input: req.input,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              text: { format: zodTextFormat(req.schema as any, req.schemaName ?? "output") },
            });
            return {
              text: res.output_text ?? "",
              parsed: (res.output_parsed as T) ?? null,
              inputTokens: res.usage?.input_tokens ?? 0,
              outputTokens: res.usage?.output_tokens ?? 0,
              latencyMs: Date.now() - t0,
            };
          }
          const res = await client.responses.create({
            model: req.model,
            ...reasoningFor(req.model, req.reasoningEffort),
            ...(req.instructions ? { instructions: req.instructions } : {}),
            input: req.input,
          });
          return {
            text: res.output_text ?? "",
            parsed: null,
            inputTokens: res.usage?.input_tokens ?? 0,
            outputTokens: res.usage?.output_tokens ?? 0,
            latencyMs: Date.now() - t0,
          };
        } catch (e) {
          lastErr = e;
          const status = (e as { status?: number }).status;
          const retriable = status === undefined || status === 429 || status >= 500;
          if (!retriable || attempt === 4) break;
          await sleep(2000 * 2 ** attempt + Math.random() * 1000);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    },
  };
}
