/**
 * ===== 쉬운 설명 =====
 * 무엇: DB 표(테이블)마다 어떤 칸이 있는지를 코드가 알 수 있게 적어 둔 목록입니다.
 * 언제: 웹앱·상시 서버가 DB에서 읽은 값을 다룰 때 오타를 막기 위해.
 * 리뷰 포인트: supabase/migrations 의 표 구조와 같은 내용입니다. 건너뛰어도 됩니다.
 * =====================
 */
/** DB 행 타입 (supabase/migrations 의 테이블과 1:1) */

export type Role = "learner" | "instructor" | "admin";
export type CohortStatus = "ready" | "running" | "paused" | "ended";
export type ConversationMode = "text" | "voice";
export type SessionStatus = "active" | "ended" | "evaluating" | "evaluated" | "failed";

export interface ProfileRow {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  role: Role;
  created_at: string;
}

export interface ScenarioRow {
  id: string;
  title: string;
  industry: string;
  type: string;
  difficulty: string;
  status: "draft" | "published" | "archived";
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioVersionRow {
  id: string;
  scenario_id: string;
  version: number;
  content: unknown; // ScenarioContent (zod 로 검증 후 사용)
  created_by: string | null;
  created_at: string;
}

export interface CohortRow {
  id: string;
  title: string;
  course_name: string | null;
  client_name: string | null;
  starts_at: string | null;
  instructor_id: string | null;
  join_code: string;
  status: CohortStatus;
  allowed_modes: ConversationMode[];
  time_limit_sec: number | null;
  sequential: boolean;
  announcement: string | null;
  budget_usd: number | null;
  created_at: string;
  /** 보관한 시각. 값이 있으면 목록에서 '보관됨'으로 분류 */
  archived_at: string | null;
}

export interface CohortScenarioRow {
  cohort_id: string;
  scenario_id: string;
  scenario_version: number;
  position: number;
  required: boolean;
}

export interface EnrollmentRow {
  id: string;
  cohort_id: string;
  user_id: string;
  joined_at: string;
  last_seen_at: string | null;
  consent_at: string;
}

export interface SessionRow {
  id: string;
  cohort_id: string;
  enrollment_id: string;
  user_id: string;
  scenario_id: string;
  scenario_version: number;
  mode: ConversationMode;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  turn_count: number;
  current_emotion: number | null;
  peak_emotion: number | null;
  openai_call_id: string | null;
  last_activity_at: string;
  usage: Record<string, number>;
}

export interface MessageRow {
  id: string;
  session_id: string;
  seq: number;
  role: "learner" | "customer";
  content: string;
  emotion: number | null;
  created_at: string;
}

export interface EvaluationRow {
  id: string;
  session_id: string;
  grade: string;
  total_score: number;
  result: unknown; // EvaluationResult
  model: string;
  prompt_version: string;
  created_at: string;
}

export interface InstructorNoteRow {
  id: string;
  evaluation_id: string;
  /** 작성자가 탈퇴하면 비어 있을 수 있음 */
  author_id: string | null;
  comment: string | null;
  score_override: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface JobPayload {
  kind: "evaluate_session" | "summarize_cohort";
  sessionId?: string;
  cohortId?: string;
}
