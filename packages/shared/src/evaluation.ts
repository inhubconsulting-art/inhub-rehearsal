/**
 * ===== 쉬운 설명 =====
 * 무엇: AI 평가 리포트의 양식, 점수→등급 규칙, 평가 결과 검사 규칙, 반 전체 요약 양식을 정의합니다.
 * 언제: 상시 서버가 AI에게 평가를 받을 때 이 양식대로 답하라고 요구하고, 받은 답을 검사할 때.
 * 리뷰 포인트: 등급 기준(90↑S, 80↑A, 70↑B, 60↑C)이 원하는 기준인지, 굿·개선 포인트가 반드시 수강생 발화를 인용해야
 *         한다는 규칙(PRD R-02)이 들어 있는지 확인하세요.
 * =====================
 */
import { z } from "zod";
import { COMPETENCIES } from "./scenario";

/**
 * AI 평가 결과 (Structured Outputs 대상).
 * Structured Outputs 호환을 위해 모든 필드는 필수이며, 값이 없을 수 있으면 nullable 로 둔다.
 * 숫자 범위는 스키마가 아니라 validateEvaluation 에서 검사한다.
 */
export const EvaluationResultSchema = z.object({
  oneLineSummary: z.string(),
  grade: z.enum(["S", "A", "B", "C", "D"]),
  totalScore: z.number(),
  competencyScores: z.array(
    z.object({
      competency: z.enum(COMPETENCIES),
      score: z.number(),
      comment: z.string(),
    }),
  ),
  goodPoints: z.array(
    z.object({
      messageSeq: z.number(),
      quote: z.string(),
      reason: z.string(),
    }),
  ),
  improvements: z.array(
    z.object({
      messageSeq: z.number(),
      quote: z.string(),
      problem: z.string(),
      betterExample: z.string(),
    }),
  ),
  checklist: z.array(
    z.object({
      stepId: z.string(),
      label: z.string(),
      done: z.boolean(),
      evidenceSeq: z.number().nullable(),
    }),
  ),
  emotionTurningPoints: z.array(
    z.object({
      messageSeq: z.number(),
      direction: z.enum(["up", "down"]),
      note: z.string(),
    }),
  ),
  recommendation: z.object({
    competency: z.enum(COMPETENCIES),
    reason: z.string(),
  }),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// 쉬운 설명: 점수 → 등급 변환 규칙. 기준을 바꾸려면 아래 숫자를 고치면 됩니다.
export function gradeFromScore(score: number): EvaluationResult["grade"] {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

/**
 * 평가 결과 검증 (PRD R-02: 모든 굿/개선 포인트는 실제 수강생 발화를 인용해야 함).
 * 문제가 있으면 사유 목록을 반환한다. 빈 배열이면 통과.
 */
// 쉬운 설명: AI 평가를 검사합니다: 점수 범위, 잘한 점·개선점이 있는지, 인용한 발화가 실제 수강생 발화인지.
export function validateEvaluation(
  ev: EvaluationResult,
  learnerSeqs: Set<number>,
): string[] {
  const problems: string[] = [];
  const inRange = (n: number) => n >= 0 && n <= 100;
  if (!inRange(ev.totalScore)) problems.push("totalScore 범위 오류");
  for (const c of ev.competencyScores) if (!inRange(c.score)) problems.push(`${c.competency} 점수 범위 오류`);
  if (ev.goodPoints.length === 0) problems.push("굿 포인트 없음");
  if (ev.improvements.length === 0) problems.push("개선 포인트 없음");
  for (const p of ev.goodPoints) if (!learnerSeqs.has(p.messageSeq)) problems.push(`굿 포인트 인용 오류(seq ${p.messageSeq})`);
  for (const p of ev.improvements) if (!learnerSeqs.has(p.messageSeq)) problems.push(`개선 포인트 인용 오류(seq ${p.messageSeq})`);
  return problems;
}

/** 반 전체 요약 (PRD A-21) */
export const CohortSummarySchema = z.object({
  headline: z.string(),
  commonStrengths: z.array(
    z.object({ title: z.string(), detail: z.string(), exampleQuote: z.string() }),
  ),
  commonWeaknesses: z.array(
    z.object({ title: z.string(), detail: z.string(), exampleQuote: z.string() }),
  ),
  coachingTips: z.array(z.string()),
});
export type CohortSummary = z.infer<typeof CohortSummarySchema>;
