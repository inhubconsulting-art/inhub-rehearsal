/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 한 개가 반드시 가져야 할 항목(양식)을 정의합니다. 업종·유형·난이도 목록과 한글 이름, 평가 역량 7가지도 여기
 *     있습니다.
 * 언제: 관리자가 시나리오를 저장할 때 빠진 항목이 없는지 검사하고, AI 지시문을 만들 때 재료로 쓰입니다.
 * 리뷰 포인트: PRD 5.1 시나리오 템플릿 표와 항목이 맞는지, 역량 7가지(PRD 6.1)와 한글 이름이 맞는지 확인하세요.
 *         toLearnerView 는 수강생에게 보여줘도 되는 정보만 골라내는 함수입니다 — 페르소나의 숨은 동기·루브릭이 빠져 있는지
 *         보세요.
 * =====================
 */
import { z } from "zod";

/** 평가 역량 (PRD 6.1) */
export const COMPETENCIES = [
  "greeting_procedure",
  "listening",
  "empathy",
  "problem_solving",
  "accuracy",
  "language",
  "voice_delivery",
] as const;
export type Competency = (typeof COMPETENCIES)[number];

export const COMPETENCY_LABELS: Record<Competency, string> = {
  greeting_procedure: "인사·표준 절차",
  listening: "경청·니즈 파악",
  empathy: "공감·감정 관리",
  problem_solving: "문제 해결·대안 제시",
  accuracy: "정확성·정책 준수",
  language: "언어 표현",
  voice_delivery: "음성 전달력",
};

export const INDUSTRIES = ["public", "medical", "finance", "insurance", "retail", "telecom", "etc"] as const;
export const INDUSTRY_LABELS: Record<(typeof INDUSTRIES)[number], string> = {
  public: "공공",
  medical: "의료",
  finance: "금융",
  insurance: "보험",
  retail: "유통",
  telecom: "통신",
  etc: "기타",
};

export const SCENARIO_TYPES = ["inquiry", "complaint", "retention", "procedure"] as const;
export const SCENARIO_TYPE_LABELS: Record<(typeof SCENARIO_TYPES)[number], string> = {
  inquiry: "문의",
  complaint: "컴플레인",
  retention: "해지 방어",
  procedure: "절차 안내",
};

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "하",
  medium: "중",
  hard: "상",
};

export const RubricItemSchema = z.object({
  id: z.string().min(1),
  competency: z.enum(COMPETENCIES),
  title: z.string().min(1),
  description: z.string().min(1),
  /** 가중치 (합이 100일 필요는 없음, 비율로 환산) */
  weight: z.number().positive().default(1),
});

export const RequiredStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const ScenarioContentSchema = z.object({
  title: z.string().min(1),
  industry: z.enum(INDUSTRIES),
  type: z.enum(SCENARIO_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  channel: z.enum(["phone", "chat"]).default("phone"),
  /** 대화 제한 시간(초) */
  timeLimitSec: z.number().int().min(60).max(3600).default(600),
  /** 최대 턴 수 (수강생 발화 기준) */
  maxTurns: z.number().int().min(2).max(100).default(30),
  /** 고객 감정을 수강생 화면에 보여줄지 */
  showEmotionToLearner: z.boolean().default(false),

  /** 수강생에게 공개되는 브리핑 */
  briefing: z.object({
    summary: z.string().min(1),
    learnerGoal: z.string().min(1),
    customerProfile: z.string().min(1),
    facts: z.array(z.string()).default([]),
    policies: z.array(z.string()).default([]),
  }),

  /** AI 고객 페르소나 (수강생 비공개) */
  persona: z.object({
    name: z.string().min(1),
    ageGroup: z.string().min(1),
    personality: z.string().min(1),
    speechStyle: z.string().min(1),
    /** 0(차분)~4(매우 화남) */
    initialEmotion: z.number().int().min(0).max(4).default(1),
    hiddenMotive: z.string().default(""),
    /** 1(참을성 없음)~5(매우 너그러움) */
    patience: z.number().int().min(1).max(5).default(3),
    openingLine: z.string().min(1),
  }),

  /** 고객이 알고 있는 사실 (수강생 비공개) */
  customerKnowledge: z.array(z.string()).default([]),

  /** 대화 전개 규칙 */
  dynamics: z.object({
    escalateWhen: z.array(z.string()).default([]),
    calmWhen: z.array(z.string()).default([]),
    resolveWhen: z.array(z.string()).default([]),
    hangupWhen: z.array(z.string()).default([]),
  }),

  /** 평가 루브릭 (평가 프롬프트에만 사용) */
  rubric: z.object({
    items: z.array(RubricItemSchema).min(1),
    requiredSteps: z.array(RequiredStepSchema).default([]),
  }),

  /** 모범 응대 예시 (평가 프롬프트에만 사용) */
  modelAnswers: z
    .array(z.object({ stage: z.string(), example: z.string() }))
    .default([]),

  voice: z
    .object({
      voice: z.string().default("marin"),
      toneInstruction: z.string().default(""),
    })
    .default({ voice: "marin", toneInstruction: "" }),
});

export type ScenarioContent = z.infer<typeof ScenarioContentSchema>;
export type RubricItem = z.infer<typeof RubricItemSchema>;

/** 수강생에게 내려도 되는 정보만 추출 */
export function toLearnerView(c: ScenarioContent) {
  return {
    title: c.title,
    industry: c.industry,
    type: c.type,
    difficulty: c.difficulty,
    channel: c.channel,
    timeLimitSec: c.timeLimitSec,
    maxTurns: c.maxTurns,
    showEmotionToLearner: c.showEmotionToLearner,
    briefing: c.briefing,
    persona: { name: c.persona.name, ageGroup: c.persona.ageGroup },
  };
}
export type LearnerScenarioView = ReturnType<typeof toLearnerView>;
