/**
 * ===== 쉬운 설명 =====
 * 무엇: 실제로 리포트를 만드는 곳. ① 대화 평가(대화 → AI 코치 → 검사 → 저장) ② 반 전체 요약.
 * 언제: 대화가 끝날 때마다, 강사가 요약을 요청할 때.
 * 리뷰 포인트: 평가 결과가 실제 수강생 발화를 인용하지 않으면 한 번 다시 시키고, 그래도 틀린 인용은 버리는 규칙(PRD R-02)을
 *         확인하세요. 수강생 발화가 하나도 없으면 평가하지 않습니다.
 * =====================
 */
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildCohortSummaryPrompt,
  buildEvaluationPrompt,
  CohortSummarySchema,
  EvaluationResultSchema,
  gradeFromScore,
  PROMPT_VERSION,
  validateEvaluation,
  type EvaluationResult,
  type JobPayload,
  type SessionRow,
} from "@inhub/shared";
import { addUsage, db, getMessages, loadScenarioContent, openai } from "./clients";
import { env } from "./env";

/** 대화 평가 → evaluations 저장 (PRD 6장) */
export async function evaluateSession(sessionId: string) {
  const { data: s } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!s) return;
  const session = s as SessionRow;
  if (session.status === "evaluated") return;

  const messages = await getMessages(sessionId);
  const learnerSeqs = new Set(messages.filter((m) => m.role === "learner").map((m) => m.seq));
  // 쉬운 설명: 수강생이 한마디도 하지 않은 대화는 평가하지 않습니다.
  if (learnerSeqs.size === 0) {
    await db.from("sessions").update({ status: "failed" }).eq("id", sessionId);
    return;
  }
  await db.from("sessions").update({ status: "evaluating" }).eq("id", sessionId);

  const content = await loadScenarioContent(session.scenario_id, session.scenario_version);
  const lines = messages.map((m) => ({ seq: m.seq, role: m.role, content: m.content }));
  const basePrompt = buildEvaluationPrompt(content, lines, session.mode);

  let result: EvaluationResult | null = null;
  let feedback = "";
  const usage = { text_input_tokens: 0, text_output_tokens: 0 };
  // 쉬운 설명: AI 평가를 받고 검사합니다. 문제가 있으면 무엇이 틀렸는지 알려주고 한 번 더 받습니다.
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    const res = await openai.responses.parse({
      model: env.evalModel,
      input: basePrompt + feedback,
      text: { format: zodTextFormat(EvaluationResultSchema, "evaluation") },
    });
    usage.text_input_tokens += res.usage?.input_tokens ?? 0;
    usage.text_output_tokens += res.usage?.output_tokens ?? 0;
    const parsed = res.output_parsed;
    if (!parsed) continue;
    const problems = validateEvaluation(parsed, learnerSeqs);
    if (problems.length === 0 || attempt === 1) {
      // 두 번째 시도에서도 인용 오류가 있으면 잘못된 인용 항목만 걸러서 사용 (PRD R-02)
      result = {
        ...parsed,
        goodPoints: parsed.goodPoints.filter((p) => learnerSeqs.has(p.messageSeq)),
        improvements: parsed.improvements.filter((p) => learnerSeqs.has(p.messageSeq)),
      };
    } else {
      feedback = `\n\n# 이전 응답의 문제 (반드시 고쳐서 다시 작성)\n${problems.map((p) => `- ${p}`).join("\n")}\n상담원(수강생) 발화 seq 목록: ${[...learnerSeqs].join(", ")}`;
    }
  }
  if (!result) throw new Error("evaluation parse failed");

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  result.totalScore = clamp(result.totalScore);
  result.competencyScores = result.competencyScores.map((c) => ({ ...c, score: clamp(c.score) }));
  // 쉬운 설명: 등급은 AI가 아니라 점수 기준표로 다시 계산해 일관성을 지킵니다.
  result.grade = gradeFromScore(result.totalScore);

  const { error } = await db.from("evaluations").upsert(
    {
      session_id: sessionId,
      grade: result.grade,
      total_score: result.totalScore,
      result,
      model: env.evalModel,
      prompt_version: PROMPT_VERSION,
    },
    { onConflict: "session_id" },
  );
  if (error) throw error;
  await db.from("sessions").update({ status: "evaluated" }).eq("id", sessionId);
  await addUsage(sessionId, usage);
}

/** 반 전체 요약 (PRD A-21) */
export async function summarizeCohort(cohortId: string) {
  const { data: cohort } = await db.from("cohorts").select("title").eq("id", cohortId).single();
  const { data } = await db
    .from("sessions")
    .select("scenario_id, scenario_version, evaluations(total_score, result)")
    .eq("cohort_id", cohortId)
    .eq("status", "evaluated")
    .order("started_at", { ascending: false })
    .limit(150);
  type Row = {
    scenario_id: string;
    scenario_version: number;
    evaluations: { total_score: number; result: EvaluationResult } | { total_score: number; result: EvaluationResult }[] | null;
  };
  const titleCache = new Map<string, string>();
  const evaluations: Parameters<typeof buildCohortSummaryPrompt>[0]["evaluations"] = [];
  for (const r of (data ?? []) as Row[]) {
    const ev = Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations;
    if (!ev) continue;
    const key = `${r.scenario_id}:${r.scenario_version}`;
    if (!titleCache.has(key)) titleCache.set(key, (await loadScenarioContent(r.scenario_id, r.scenario_version)).title);
    evaluations.push({
      scenarioTitle: titleCache.get(key)!,
      totalScore: Number(ev.total_score),
      summary: ev.result.oneLineSummary,
      good: ev.result.goodPoints.map((g) => g.reason),
      improve: ev.result.improvements.map((g) => g.problem),
    });
  }
  if (evaluations.length === 0) {
    await db.from("cohort_summaries").upsert({ cohort_id: cohortId, status: "failed", updated_at: new Date().toISOString() });
    return;
  }

  const res = await openai.responses.parse({
    model: env.evalModel,
    input: buildCohortSummaryPrompt({ cohortTitle: (cohort as { title: string }).title, evaluations }),
    text: { format: zodTextFormat(CohortSummarySchema, "cohort_summary") },
  });
  if (!res.output_parsed) throw new Error("summary parse failed");
  await db.from("cohort_summaries").upsert({
    cohort_id: cohortId,
    content: res.output_parsed,
    status: "ready",
    evaluation_count: evaluations.length,
    updated_at: new Date().toISOString(),
  });
}

/** 실패가 반복된 작업 정리 */
export async function markJobFailed(job: JobPayload) {
  if (job.kind === "evaluate_session" && job.sessionId) {
    await db.from("sessions").update({ status: "failed" }).eq("id", job.sessionId).neq("status", "evaluated");
  }
  if (job.kind === "summarize_cohort" && job.cohortId) {
    await db.from("cohort_summaries").upsert({ cohort_id: job.cohortId, status: "failed", updated_at: new Date().toISOString() });
  }
}
