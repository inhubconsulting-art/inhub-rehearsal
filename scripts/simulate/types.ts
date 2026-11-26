/**
 * ===== 쉬운 설명 =====
 * 무엇: 시뮬레이터가 주고받는 기록의 모양(타입)을 한곳에 모아 둔 파일입니다.
 * 언제: 시뮬레이터의 모든 파일이 이 모양을 씁니다.
 * 리뷰 포인트: 결과 파일(sessions.jsonl, turns.csv)에 어떤 칸이 남는지 보려면 여기 SessionRecord / TurnRecord 를 보세요.
 * =====================
 */
import type { CustomerState, EndReason, EvaluationResult, ScenarioContent, SessionAnalysis } from "../../packages/shared/src/index.ts";

/** 시뮬레이션에 쓰는 시나리오 한 개 */
export interface SimScenario {
  id: string;
  version: number;
  content: ScenarioContent;
  /** db = 운영 DB에서 읽음, seed = supabase/seed.sql 에서 읽음 */
  source: "db" | "seed";
}

/** 가상 참여자 (수강생 역할을 하는 AI 에게 주는 사람 정보) */
export interface Participant {
  id: string;
  name: string;
  age: number;
  organization: string;
  job: string;
  career: string;
  /** 말투·습관 설명 (수강생 AI 지시문에 들어감) */
  style: string;
  /** 1초에 치는 글자 수 (가상 시계 계산용) */
  typingCps: number;
  /** 고객 말을 읽고 답을 생각하는 데 드는 초 */
  thinkSec: number;
}

/** 수강생 AI 가 한 번에 낼 수 있는 행동 */
export type LearnerAction =
  | { kind: "say"; text: string }
  | { kind: "end" } // '대화 종료' 버튼
  | { kind: "handoff"; target: string; memo: string }; // '연결·이관' 버튼 + 인계 메모

/** 한 턴(수강생 1발화 → 고객 1발화 → 판단)의 모든 기록 */
export interface TurnRecord {
  turn: number;
  learnerSeq: number;
  customerSeq: number | null;
  learnerText: string;
  customerText: string | null;
  /** 가상 시계 기준, 대화 시작 후 경과 초 */
  learnerAtSec: number;
  customerAtSec: number | null;
  /** 실제 API 응답 시간(ms) */
  customerLatencyMs: number | null;
  classifierLatencyMs: number | null;
  learnerSimLatencyMs: number | null;
  prevEmotion: number;
  /** 판단 AI 가 돌려준 감정 원래 값 (자르기 전) */
  rawEmotion: number | null;
  emotion: number;
  emotionDelta: number;
  state: CustomerState | null;
  classifierFailed: boolean;
  /** 이 턴에 고객 지시문 끝에 '마무리' 지시가 붙어 있었는지 */
  wrapUpDirectiveActive: boolean;
  learnerTurns: number;
  learnerTurnsSinceWrapUp: number;
  outcome: { endReason: EndReason | null; startWrapUp: boolean; handoffPending: boolean } | null;
  /** 화면의 '연결 대기' 띠가 떠 있었는지 */
  handoffBannerShown: boolean;
  error: string | null;
  flags: string[];
}

export interface EvalAttempt {
  attempt: number;
  latencyMs: number;
  parsed: boolean;
  problems: string[];
  rawGrade: string | null;
  rawTotalScore: number | null;
}

export interface EvaluationRecord {
  ran: boolean;
  /** 평가를 하지 않은 이유 (수강생 발화 없음 등) */
  skippedReason: string | null;
  attempts: EvalAttempt[];
  result: EvaluationResult | null;
  /** AI 가 준 등급 vs 점수표로 다시 계산한 등급 */
  aiGrade: string | null;
  finalGrade: string | null;
  droppedGoodPoints: number;
  droppedImprovements: number;
  /** 인용 문장이 그 발화 원문에 실제로 들어 있지 않은 항목 수 (서비스는 검사하지 않음, 시뮬레이터만 확인) */
  quoteTextMismatches: { messageSeq: number; quote: string }[];
  error: string | null;
}

export interface Anomaly {
  code: string;
  severity: "error" | "warn" | "info";
  message: string;
  turn?: number;
}

export interface ExpectationResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SessionMessage {
  id: string;
  seq: number;
  role: "learner" | "customer";
  content: string;
  created_at: string;
}

export interface SessionRecord {
  runId: string;
  sessionId: string;
  scenario: { id: string; version: number; title: string; industry: string; type: string; difficulty: string; source: string };
  caseId: string;
  caseLabel: string;
  repeat: number;
  participant: Participant;
  mode: "text";
  models: { learnerSim: string; customer: string; classifier: string; eval: string; reasoningEffort: string | null };
  promptVersion: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  timeLimitSec: number;
  maxTurns: number;
  endReason: EndReason | null;
  /** 누가 끝냈나: system(종료 규칙) / learner(버튼) / timer(화면 타이머) / harness(무한 대화 방지) */
  endedBy: "system" | "learner" | "timer" | "harness" | null;
  initialEmotion: number;
  peakEmotion: number;
  finalEmotion: number;
  emotionPath: number[];
  resolvedAtTurn: number | null;
  handoff: { status: "pending" | "done"; target?: string; memo?: string; pendingAtTurn?: number } | null;
  messages: SessionMessage[];
  turns: TurnRecord[];
  evaluation: EvaluationRecord;
  analytics: SessionAnalysis | null;
  usage: { text_input_tokens: number; text_output_tokens: number; sim_input_tokens: number; sim_output_tokens: number };
  costUsd: { service: number; simulator: number };
  anomalies: Anomaly[];
  expectations: ExpectationResult[];
  error: string | null;
}
