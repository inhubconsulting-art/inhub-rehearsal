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

/**
 * 쉬운 설명: 음성 대화에서 AI 고객이 '수강생 말이 끝났다'고 판단하는 방식.
 * OpenAI semantic_vad 를 씁니다. 침묵 길이만 보지 않고 '말이 끝난 문장인지'를 AI가 판단해서,
 * "음…", "그게…"처럼 말끝을 흐리면 더 기다려 줍니다. 최대 대기 시간은 느긋하게 8초, 보통 4초, 빠르게 2초입니다.
 */
export const WAIT_FOR_LEARNER = ["patient", "normal", "quick"] as const;
export type WaitForLearner = (typeof WAIT_FOR_LEARNER)[number];
export const WAIT_FOR_LEARNER_LABELS: Record<WaitForLearner, string> = {
  patient: "느긋하게 기다림 (머뭇거려도 기다려 줌, 추천)",
  normal: "보통",
  quick: "빠르게 반응 (성격 급한 고객)",
};
const WAIT_TO_EAGERNESS: Record<WaitForLearner, "low" | "medium" | "high"> = { patient: "low", normal: "medium", quick: "high" };

/** OpenAI 음성 통화의 turn_detection 설정값 */
export function turnDetectionFor(wait: WaitForLearner | undefined) {
  return {
    type: "semantic_vad" as const,
    eagerness: WAIT_TO_EAGERNESS[wait ?? "patient"],
    create_response: true,
    // 수강생이 AI 말 도중에 끼어들면 AI가 말을 멈춤 (실제 통화처럼)
    interrupt_response: true,
  };
}

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
    /** 이 상황에서 연결·이관할 수 있는 곳 (예: '간호사 상담실', '담당 부서 회신 예약'). 수강생에게 보임 */
    handoffTargets: z.array(z.string()).default([]),
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
    /** 고객이 묻지 않아도 상담원이 반드시 안내해야 할 내용 (빠뜨리거나 틀리면 감점). 고객은 모름 */
    mustInform: z.array(z.string()).default([]),
    /** 연결·이관이 필요한 경우와 바른 이관 방법 (평가 기준, 비어 있으면 '필요 시 판단') */
    handoffExpected: z.string().default(""),
  }),

  /** 모범 응대 예시 (평가 프롬프트에만 사용) */
  modelAnswers: z
    .array(z.object({ stage: z.string(), example: z.string() }))
    .default([]),

  voice: z
    .object({
      voice: z.string().default("marin"),
      toneInstruction: z.string().default(""),
      /** 수강생이 말을 멈췄을 때 AI 고객이 얼마나 기다렸다가 대답할지 (음성 모드) */
      waitForLearner: z.enum(WAIT_FOR_LEARNER).default("patient"),
    })
    .default({ voice: "marin", toneInstruction: "", waitForLearner: "patient" }),
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
