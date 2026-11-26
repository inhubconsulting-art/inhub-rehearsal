/**
 * ===== 쉬운 설명 =====
 * 무엇: 실습 1회를 처음부터 끝까지 돌리는 엔진. 서비스 코드와 같은 순서·같은 규칙으로 움직입니다.
 *   ① 가상 수강생 발화 → ② AI 고객 답변 (buildCustomerInstructions + 마무리 신호) → ③ 고객 상태 판단 (buildClassifierPrompt)
 *   → ④ 종료 규칙 (decideTurnOutcome) → … → 종료 → ⑤ 평가 (buildEvaluationPrompt + validateEvaluation, 최대 2번)
 *   → ⑥ 대화 분석 (analyzeConversation)
 * 언제: run.ts 가 시나리오 × 케이스마다 한 번씩 부릅니다.
 * 리뷰 포인트:
 *   - ②~④는 apps/web/src/app/api/sessions/[id]/messages/route.ts 를, ⑤는 apps/worker/src/jobs.ts 를 그대로 옮겼습니다.
 *     서비스 코드가 바뀌면 이 파일도 같이 맞춰야 합니다(지시문·판단·종료 규칙·검증 함수는 공통 패키지를 그대로 불러 쓰므로 자동 반영).
 *   - DB 대신 메모리에 기록합니다. 운영 DB에는 아무것도 쓰지 않습니다.
 *   - 시간은 '가상 시계'입니다: 수강생이 생각·타자하는 시간(참여자별 속도) + 실제 AI 응답 시간을 더해 흐릅니다.
 *     그래서 응답 시간 분석과 시간 초과가 실제처럼 나옵니다.
 * =====================
 */
import { randomUUID } from "node:crypto";
import {
  analyzeConversation,
  buildClassifierPrompt,
  buildCustomerInstructions,
  buildEvaluationPrompt,
  clampEmotion,
  CustomerStateSchema,
  decideTurnOutcome,
  EvaluationResultSchema,
  gradeFromScore,
  PROMPT_VERSION,
  validateEvaluation,
  WRAP_UP_DIRECTIVE,
  type CustomerState,
  type EndReason,
  type EvaluationResult,
  type Lexicon,
  type TranscriptLine,
} from "../../packages/shared/src/index.ts";
import type { SimCase } from "./cases.ts";
import { detectAnomalies, detectEvalCoverage } from "./checks.ts";
import { nextLearnerAction, writeHandoffMemo } from "./learner.ts";
import type { Llm } from "./llm.ts";
import type { EvaluationRecord, Participant, SessionMessage, SessionRecord, SimScenario, TurnRecord } from "./types.ts";

export interface EngineConfig {
  llm: Llm;
  models: { learnerSim: string; customer: string; classifier: string; eval: string };
  /** 서비스 쪽(AI 고객·판단)에 쓰는 사고량 옵션 = OPENAI_REASONING_EFFORT */
  serviceReasoning: string | null;
  /** 가상 수강생 사고량 */
  simReasoning: string | null;
  lexicon: Lexicon;
  timeLimitOverride: number | null;
  prices: { textIn: number; textOut: number };
}

/** 끝나지 않는 대화를 막는 안전장치: 최대 턴 + 이만큼 더 가면 시뮬레이터가 강제로 멈춤 */
const HARNESS_EXTRA_TURNS = 4;

export async function runSession(args: {
  cfg: EngineConfig;
  runId: string;
  scenario: SimScenario;
  sc: SimCase;
  participant: Participant;
  repeat: number;
}): Promise<SessionRecord> {
  const { cfg, scenario, sc, participant } = args;
  const content = scenario.content;
  const llm = cfg.llm;
  const timeLimitSec = cfg.timeLimitOverride ?? content.timeLimitSec;
  const startedAtMs = Date.now();
  const iso = (offsetMs: number) => new Date(startedAtMs + offsetMs).toISOString();
  const slow = sc.slowFactor ?? 1;

  const rec: SessionRecord = {
    runId: args.runId,
    sessionId: `${args.runId}__${scenario.id.slice(0, 8)}__${sc.id}__r${args.repeat}`,
    scenario: {
      id: scenario.id,
      version: scenario.version,
      title: content.title,
      industry: content.industry,
      type: content.type,
      difficulty: content.difficulty,
      source: scenario.source,
    },
    caseId: sc.id,
    caseLabel: sc.label,
    repeat: args.repeat,
    participant,
    mode: "text",
    models: { ...cfg.models, reasoningEffort: cfg.serviceReasoning },
    promptVersion: PROMPT_VERSION,
    startedAt: iso(0),
    endedAt: null,
    durationSec: null,
    timeLimitSec,
    maxTurns: content.maxTurns,
    endReason: null,
    endedBy: null,
    initialEmotion: content.persona.initialEmotion,
    peakEmotion: content.persona.initialEmotion,
    finalEmotion: content.persona.initialEmotion,
    emotionPath: [content.persona.initialEmotion],
    resolvedAtTurn: null,
    handoff: null,
    messages: [],
    turns: [],
    evaluation: emptyEval(),
    analytics: null,
    usage: { text_input_tokens: 0, text_output_tokens: 0, sim_input_tokens: 0, sim_output_tokens: 0 },
    costUsd: { service: 0, simulator: 0 },
    anomalies: [],
    expectations: [],
    error: null,
  };

  // ----- 메모리 속 '세션 행' (DB sessions 표 대신) -----
  let clockMs = 0; // 가상 시계 (대화 시작 후 경과 ms)
  let currentEmotion: number | null = null; // sessions.current_emotion (처음엔 비어 있음)
  let resolvedAtMs: number | null = null; // sessions.resolved_at
  let seq = 0;
  const messages: SessionMessage[] = rec.messages;
  const append = (role: "learner" | "customer", text: string): SessionMessage => {
    const m = { id: randomUUID(), seq: ++seq, role, content: text, created_at: iso(clockMs) };
    messages.push(m);
    return m;
  };
  const end = (reason: EndReason, by: SessionRecord["endedBy"]) => {
    if (rec.endReason) return;
    rec.endReason = reason;
    rec.endedBy = by;
    rec.endedAt = iso(clockMs);
    rec.durationSec = Math.round(clockMs / 100) / 10;
  };
  const simTok = (i: number, o: number) => {
    rec.usage.sim_input_tokens += i;
    rec.usage.sim_output_tokens += o;
  };
  const svcTok = (i: number, o: number) => {
    rec.usage.text_input_tokens += i;
    rec.usage.text_output_tokens += o;
  };

  try {
    let turn = 0;
    while (!rec.endReason) {
      const learnerTurnsSoFar = messages.filter((m) => m.role === "learner").length;
      const handoffBanner = rec.handoff?.status === "pending";

      // ----- 안전장치: 서비스 규칙으로 끝나지 않는 대화 -----
      if (learnerTurnsSoFar >= content.maxTurns + HARNESS_EXTRA_TURNS) {
        end("abandoned", "harness");
        break;
      }

      // ----- ① 수강생 차례: 버튼(종료·이관) 또는 메시지 -----
      // 케이스가 정한 강제 버튼
      if (sc.forceEndAfterLearnerTurns && learnerTurnsSoFar >= sc.forceEndAfterLearnerTurns) {
        clockMs += 2000 * slow;
        end("learner_ended", "learner");
        break;
      }
      const forceHandoff = !!sc.forceHandoffAfterLearnerTurns && learnerTurnsSoFar >= sc.forceHandoffAfterLearnerTurns;
      const autoHandoff = handoffBanner && sc.pressHandoffWhenPending !== false;
      let action: Awaited<ReturnType<typeof nextLearnerAction>>["action"];
      let learnerLatency: number | null = null;
      if (forceHandoff || autoHandoff) {
        action = { kind: "handoff", target: "", memo: "" };
      } else {
        const remainingSec = timeLimitSec - clockMs / 1000;
        const r = await nextLearnerAction({
          llm,
          model: cfg.models.learnerSim,
          reasoningEffort: cfg.simReasoning,
          content,
          sc,
          participant,
          messages,
          remainingSec,
          handoffBanner,
          learnerTurns: learnerTurnsSoFar,
        });
        simTok(r.inTok, r.outTok);
        learnerLatency = r.latencyMs;
        action = r.action;
      }

      if (action.kind === "end") {
        clockMs += 2000 * slow;
        end("learner_ended", "learner");
        break;
      }
      if (action.kind === "handoff") {
        // 연결·이관 창 작성 → POST /api/sessions/[id]/handoff 와 같은 결과
        const m = await writeHandoffMemo({
          llm,
          model: cfg.models.learnerSim,
          reasoningEffort: cfg.simReasoning,
          content,
          participant,
          messages,
          careless: forceHandoff,
        });
        simTok(m.inTok, m.outTok);
        clockMs += (participant.thinkSec + m.memo.length / participant.typingCps) * 1000 * slow;
        if (clockMs > timeLimitSec * 1000) {
          clockMs = timeLimitSec * 1000;
          end("time_limit", "timer");
          break;
        }
        rec.handoff = { ...(rec.handoff ?? {}), status: "done", target: m.target, memo: m.memo };
        end("transferred", "learner");
        break;
      }

      // 메시지 보내기 전에 화면 타이머가 먼저 끝나는지 (화면은 0초가 되면 time_limit 으로 종료)
      const composeMs = (participant.thinkSec + action.text.length / participant.typingCps) * 1000 * slow;
      if (clockMs + composeMs > timeLimitSec * 1000) {
        clockMs = timeLimitSec * 1000;
        end("time_limit", "timer");
        break;
      }
      clockMs += composeMs;

      // ----- 이하 messages/route.ts 와 같은 순서 -----
      turn++;
      const t: TurnRecord = {
        turn,
        learnerSeq: 0,
        customerSeq: null,
        learnerText: action.text,
        customerText: null,
        learnerAtSec: round1(clockMs / 1000),
        customerAtSec: null,
        customerLatencyMs: null,
        classifierLatencyMs: null,
        learnerSimLatencyMs: learnerLatency,
        prevEmotion: currentEmotion ?? content.persona.initialEmotion,
        rawEmotion: null,
        emotion: currentEmotion ?? content.persona.initialEmotion,
        emotionDelta: 0,
        state: null,
        classifierFailed: false,
        wrapUpDirectiveActive: resolvedAtMs != null,
        learnerTurns: 0,
        learnerTurnsSinceWrapUp: 0,
        outcome: null,
        handoffBannerShown: handoffBanner,
        error: null,
        flags: [],
      };
      rec.turns.push(t);

      // 1단계: 수강생 메시지 저장
      const learnerMsg = append("learner", action.text);
      t.learnerSeq = learnerMsg.seq;

      const history = [...messages];
      const input = history.map((m) => ({ role: m.role === "learner" ? ("user" as const) : ("assistant" as const), content: m.content }));
      const instructions = buildCustomerInstructions(content, "text") + (resolvedAtMs != null ? `\n\n${WRAP_UP_DIRECTIVE}` : "");
      const learnerTurns = history.filter((m) => m.role === "learner").length;
      const learnerTurnsSinceWrapUp =
        resolvedAtMs != null ? history.filter((m) => m.role === "learner" && Date.parse(m.created_at) > startedAtMs + resolvedAtMs!).length : 0;
      t.learnerTurns = learnerTurns;
      t.learnerTurnsSinceWrapUp = learnerTurnsSinceWrapUp;

      // 2단계: AI 고객 답변
      let reply: string;
      try {
        const res = await llm.call({
          kind: "customer",
          model: cfg.models.customer,
          reasoningEffort: cfg.serviceReasoning,
          instructions,
          input,
          hint: { caseId: sc.id, learnerText: action.text, wrapUp: resolvedAtMs != null, turn, persona: content.persona.name },
        });
        svcTok(res.inputTokens, res.outputTokens);
        t.customerLatencyMs = res.latencyMs;
        clockMs += res.latencyMs;
        reply = res.text.trim() || "…";
      } catch (e) {
        // 서비스에서는 화면에 '다시 보내 주세요' 오류가 뜨고 고객 답변이 저장되지 않음
        t.error = `AI 고객 응답 오류: ${errMsg(e)}`;
        continue;
      }

      // 3단계: 고객 답변 저장
      const customerMsg = append("customer", reply);
      t.customerSeq = customerMsg.seq;
      t.customerText = reply;
      t.customerAtSec = round1(clockMs / 1000);

      const lines: TranscriptLine[] = messages.map((m) => ({ seq: m.seq, role: m.role, content: m.content }));

      // 4단계: 고객 상태 판단 (lib/openai.ts classifyCustomerState 와 같음: 최근 12줄만)
      const prevEmotion = currentEmotion ?? content.persona.initialEmotion;
      let state: CustomerState;
      try {
        const res = await llm.call({
          kind: "classifier",
          model: cfg.models.classifier,
          reasoningEffort: cfg.serviceReasoning,
          input: buildClassifierPrompt(content, lines.slice(-12), prevEmotion),
          schema: CustomerStateSchema,
          schemaName: "customer_state",
          hint: { caseId: sc.id, learnerText: action.text, customerText: reply, prevEmotion, learnerTurns, handoffStatus: rec.handoff?.status ?? null },
        });
        svcTok(res.inputTokens, res.outputTokens);
        t.classifierLatencyMs = res.latencyMs;
        const parsed = res.parsed as CustomerState | null;
        if (parsed) {
          t.rawEmotion = parsed.emotion;
          state = { ...parsed, emotion: clampEmotion(parsed.emotion) };
        } else {
          t.classifierFailed = true;
          state = { emotion: prevEmotion, resolved: false, endConversation: false, learnerClosing: false, handoffAccepted: false, reason: "판단 실패" };
        }
      } catch (e) {
        // 서비스에서는 이 경우 전체 턴이 오류 처리됨(고객 답변은 이미 저장됨)
        t.error = `상태 판단 오류: ${errMsg(e)}`;
        t.classifierFailed = true;
        continue;
      }
      t.state = state;
      t.prevEmotion = prevEmotion;
      t.emotion = state.emotion;
      t.emotionDelta = state.emotion - prevEmotion;
      currentEmotion = state.emotion; // setCustomerEmotion
      rec.emotionPath.push(state.emotion);

      // 5단계: 종료 규칙
      const outcome = decideTurnOutcome({
        state,
        resolvedAt: resolvedAtMs != null ? iso(resolvedAtMs) : null,
        learnerTurnsSinceWrapUp,
        learnerTurns,
        maxTurns: content.maxTurns,
        handoffStatus: rec.handoff?.status,
      });
      t.outcome = outcome;
      // 서비스는 판단이 끝난 시각(now)을 resolved_at 으로 기록 → 판단 응답 시간만큼 뒤
      if (outcome.startWrapUp) {
        resolvedAtMs = clockMs + (t.classifierLatencyMs ?? 0);
        rec.resolvedAtTurn = turn;
      }
      if (outcome.handoffPending) rec.handoff = { status: "pending", pendingAtTurn: turn };
      t.handoffBannerShown = outcome.handoffPending || rec.handoff?.status === "pending";
      if (outcome.endReason) end(outcome.endReason, "system");
    }
  } catch (e) {
    rec.error = errMsg(e);
    if (!rec.endReason) end("error", "harness");
  }

  rec.peakEmotion = Math.max(...rec.emotionPath);
  rec.finalEmotion = rec.emotionPath.at(-1) ?? rec.initialEmotion;

  // ----- ⑤ 평가 (apps/worker/src/jobs.ts evaluateSession 과 같음) -----
  rec.evaluation = await evaluate(cfg, rec, sc, content);
  // ----- ⑥ 대화 분석 (apps/worker/src/analytics.ts 와 같음) -----
  try {
    rec.analytics = analyzeConversation({
      messages,
      mode: "text",
      startedAt: rec.startedAt,
      endedAt: rec.endedAt,
      lexicon: cfg.lexicon,
    }).session;
  } catch (e) {
    rec.anomalies.push({ code: "ANALYTICS_FAIL", severity: "warn", message: `대화 분석 실패: ${errMsg(e)}` });
  }

  const price = (i: number, o: number) => (i / 1e6) * cfg.prices.textIn + (o / 1e6) * cfg.prices.textOut;
  rec.costUsd = {
    service: round4(price(rec.usage.text_input_tokens, rec.usage.text_output_tokens)),
    simulator: round4(price(rec.usage.sim_input_tokens, rec.usage.sim_output_tokens)),
  };

  rec.anomalies.push(...detectAnomalies(rec, sc));
  rec.anomalies.push(
    ...detectEvalCoverage(
      rec,
      [...new Set(content.rubric.items.map((i) => i.competency))],
      content.rubric.requiredSteps.map((s) => s.id),
    ),
  );
  rec.expectations = sc.expect.map((f) => {
    try {
      return f(rec);
    } catch (e) {
      return { id: "error", label: "기대 결과 계산", passed: false, detail: errMsg(e) };
    }
  });
  return rec;
}

function emptyEval(): EvaluationRecord {
  return {
    ran: false,
    skippedReason: null,
    attempts: [],
    result: null,
    aiGrade: null,
    finalGrade: null,
    droppedGoodPoints: 0,
    droppedImprovements: 0,
    quoteTextMismatches: [],
    error: null,
  };
}

async function evaluate(cfg: EngineConfig, rec: SessionRecord, sc: SimCase, content: SimScenario["content"]): Promise<EvaluationRecord> {
  const out = emptyEval();
  const messages = rec.messages;
  const learnerSeqs = new Set(messages.filter((m) => m.role === "learner").map((m) => m.seq));
  // 수강생이 한마디도 하지 않은 대화는 평가하지 않음 (서비스: status = failed)
  if (learnerSeqs.size === 0) {
    out.skippedReason = "수강생 발화 없음 (서비스에서는 '평가 없음'으로 표시)";
    return out;
  }
  out.ran = true;
  const lines = messages.map((m) => ({ seq: m.seq, role: m.role, content: m.content }));
  const basePrompt = buildEvaluationPrompt(content, lines, "text", {
    endReason: rec.endReason,
    handoff: rec.handoff?.status === "done" ? rec.handoff : null,
  });

  let result: EvaluationResult | null = null;
  let feedback = "";
  try {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const res = await cfg.llm.call({
        kind: "eval",
        model: cfg.models.eval,
        reasoningEffort: null, // jobs.ts 는 평가에 사고량 옵션을 쓰지 않음
        input: basePrompt + feedback,
        schema: EvaluationResultSchema,
        schemaName: "evaluation",
        hint: {
          caseId: sc.id,
          attempt,
          learnerSeqs: [...learnerSeqs],
          messages,
          handoff: rec.handoff,
          endReason: rec.endReason,
          competencies: [...new Set(content.rubric.items.map((i) => i.competency))],
          steps: content.rubric.requiredSteps,
        },
      });
      rec.usage.text_input_tokens += res.inputTokens;
      rec.usage.text_output_tokens += res.outputTokens;
      const parsed = res.parsed as EvaluationResult | null;
      const problems = parsed ? validateEvaluation(parsed, learnerSeqs) : ["형식 해석 실패"];
      out.attempts.push({
        attempt: attempt + 1,
        latencyMs: res.latencyMs,
        parsed: !!parsed,
        problems,
        rawGrade: parsed?.grade ?? null,
        rawTotalScore: parsed?.totalScore ?? null,
      });
      if (!parsed) continue;
      if (problems.length === 0 || attempt === 1) {
        const good = parsed.goodPoints.filter((p) => learnerSeqs.has(p.messageSeq));
        const imp = parsed.improvements.filter((p) => learnerSeqs.has(p.messageSeq));
        out.droppedGoodPoints = parsed.goodPoints.length - good.length;
        out.droppedImprovements = parsed.improvements.length - imp.length;
        result = { ...parsed, goodPoints: good, improvements: imp };
      } else {
        feedback = `\n\n# 이전 응답의 문제 (반드시 고쳐서 다시 작성)\n${problems.map((p) => `- ${p}`).join("\n")}\n상담원(수강생) 발화 seq 목록: ${[...learnerSeqs].join(", ")}`;
      }
    }
    if (!result) throw new Error("evaluation parse failed");
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    out.aiGrade = result.grade;
    result.totalScore = clamp(result.totalScore);
    result.competencyScores = result.competencyScores.map((c) => ({ ...c, score: clamp(c.score) }));
    result.grade = gradeFromScore(result.totalScore);
    out.finalGrade = result.grade;
    out.result = result;

    // 서비스는 인용 '번호'만 검사합니다. 시뮬레이터는 인용 '문장'이 그 발화에 실제로 있는지도 확인해 둡니다.
    const norm = (s: string) => s.replace(/[\s.,!?…~·"'“”‘’()\[\]]/g, "");
    for (const p of [...result.goodPoints, ...result.improvements]) {
      const msg = messages.find((m) => m.seq === p.messageSeq);
      const parts = p.quote.split(/\.{2,}|…/).map(norm).filter((x) => x.length >= 2);
      const okQuote = !!msg && parts.length > 0 && parts.every((x) => norm(msg.content).includes(x));
      if (!okQuote) out.quoteTextMismatches.push({ messageSeq: p.messageSeq, quote: p.quote });
    }
  } catch (e) {
    // 서비스에서는 대기열이 3번까지 다시 시도한 뒤 '평가 실패'
    out.error = errMsg(e);
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
