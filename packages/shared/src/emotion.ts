/**
 * ===== 쉬운 설명 =====
 * 무엇: 고객 감정 5단계(차분~매우 화남)와 대화가 끝나는 이유(문제 해결, 시간 초과 등)의 한글 이름을 정의합니다.
 * 언제: AI 고객의 감정을 판단·표시할 때, 리포트에 종료 사유를 보여줄 때.
 * 리뷰 포인트: 감정 단계 이름과 종료 사유 문구가 교육 현장 용어와 맞는지 확인하세요.
 * =====================
 */
import { z } from "zod";

export const EMOTION_LABELS = ["차분", "약간 불만", "불만", "화남", "매우 화남"] as const;
export const MAX_EMOTION = 4;

export function emotionLabel(level: number | null | undefined): string {
  if (level == null) return "-";
  return EMOTION_LABELS[Math.max(0, Math.min(MAX_EMOTION, Math.round(level)))];
}

/** 매 고객 발화 직후 판단하는 고객 상태 */
export const CustomerStateSchema = z.object({
  /** 0(차분)~4(매우 화남) */
  emotion: z.number(),
  /** 고객의 문제가 해결되었는가 */
  resolved: z.boolean(),
  /** 고객이 대화를 끝내려 하는가 (해결되어 인사하거나, 화가 나서 끊음) */
  endConversation: z.boolean(),
  /** 판단 근거 한 줄 */
  reason: z.string(),
});
export type CustomerState = z.infer<typeof CustomerStateSchema>;

export function clampEmotion(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(MAX_EMOTION, Math.round(n)));
}

export type EndReason =
  | "resolved"
  | "customer_left"
  | "time_limit"
  | "turn_limit"
  | "learner_ended"
  | "abandoned"
  | "error";

export const END_REASON_LABELS: Record<EndReason, string> = {
  resolved: "문제 해결",
  customer_left: "고객이 대화를 끝냄",
  time_limit: "시간 초과",
  turn_limit: "턴 수 초과",
  learner_ended: "수강생이 종료",
  abandoned: "응답 없이 중단",
  error: "오류로 종료",
};
