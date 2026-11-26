/**
 * ===== 쉬운 설명 =====
 * 무엇: 케이스와 상관없이 '흐름이 어색하거나 오류인 곳'을 자동으로 찾아 표시하는 검사 목록입니다.
 * 언제: 실습 1회가 끝나고 평가·분석까지 마친 뒤.
 * 리뷰 포인트: 코드(code)별 의미는 아래 CODE_INFO 에 있습니다. 리포트에서 같은 코드가 여러 시나리오에 반복되면
 *   지시문·종료 규칙 쪽 문제일 가능성이 큽니다. 기준 숫자(예: 고객 답변 200자)는 필요하면 고치세요.
 *   severity: error = 서비스 규칙상 일어나면 안 됨 / warn = 어색한 흐름일 가능성 / info = 참고
 * =====================
 */
import type { SimCase } from "./cases.ts";
import type { Anomaly, SessionRecord } from "./types.ts";

export const CODE_INFO: Record<string, { label: string; severity: Anomaly["severity"]; hint: string }> = {
  RUN_ERROR: { label: "실행 오류", severity: "error", hint: "API 오류 등으로 실습이 중간에 멈춤" },
  TURN_ERROR: { label: "턴 오류", severity: "error", hint: "AI 고객 답변 또는 상태 판단 호출 실패 (서비스에서는 '다시 보내 주세요' 오류)" },
  CLASSIFIER_FALLBACK: { label: "상태 판단 실패", severity: "error", hint: "판단 AI 응답을 해석하지 못해 직전 감정·미해결로 대체됨" },
  NEVER_ENDS: { label: "끝나지 않는 대화", severity: "error", hint: "최대 턴을 넘겨도 종료 규칙이 대화를 끝내지 않아 시뮬레이터가 강제로 멈춤 (연결 대기 상태에서 턴 제한이 검사되지 않는 경우 등)" },
  EMOTION_JUMP: { label: "감정 급변", severity: "warn", hint: "한 턴에 감정이 2단계 이상 바뀜 (판단 지시문은 '드물다'고 함)" },
  EMOTION_RAW_INVALID: { label: "감정 값 이상", severity: "info", hint: "판단 AI가 0~4 정수가 아닌 값을 줘서 코드가 잘라냄" },
  RESOLVED_FLIP: { label: "해결 판단 뒤집힘", severity: "warn", hint: "'용건 해결'이 true 였다가 다시 false 가 됨" },
  CUSTOMER_LONG: { label: "고객 답변이 김", severity: "warn", hint: "고객 답변이 4문장 이상 또는 200자 초과 (지시문: 1~3문장)" },
  CUSTOMER_BREAKS_ROLE: { label: "고객 역할 깨짐", severity: "error", hint: "고객이 AI·프롬프트·롤플레이 등을 언급" },
  CUSTOMER_REPEATS_QUESTION: { label: "고객이 같은 질문 반복", severity: "warn", hint: "앞에서 한 질문과 거의 같은 질문을 다시 함 (지시문: 답을 들은 질문은 다시 묻지 않음)" },
  NEW_QUESTION_AFTER_WRAPUP: { label: "마무리 신호 뒤 새 질문", severity: "warn", hint: "'이제 인사하고 끝내세요'가 붙은 뒤에도 고객이 질문함" },
  GOODBYE_NOT_ENDED: { label: "작별 인사 뒤 대화 계속", severity: "warn", hint: "고객이 감사·작별 인사를 했는데 종료 판단이 안 되어 대화가 2턴 이상 이어짐" },
  LEARNER_HAD_TO_END: { label: "수강생이 직접 끝내야 함", severity: "warn", hint: "자연스럽게 끝나야 할 대화가 안 끝나 가상 수강생이 종료 버튼을 누름" },
  WRAPUP_NO_END: { label: "마무리 신호 뒤 미종료", severity: "warn", hint: "마무리 신호 후 수강생 2턴이 지나도 '문제 해결'로 끝나지 않음" },
  HANDOFF_PENDING_UNEXPECTED: { label: "예상 밖 연결 대기", severity: "warn", hint: "연결·이관 케이스가 아닌데 판단 AI가 '이관 수락'으로 보고 연결 대기 띠를 띄움 (회신 약속·결과 알림을 이관으로 본 경우 등)" },
  LEARNER_MSG_LONG: { label: "가상 수강생 메시지가 김", severity: "info", hint: "가상 수강생 메시지가 150자 초과 (테스트 현실성 확인용, 서비스 문제 아님)" },
  HANDOFF_PENDING_LONG: { label: "연결 대기 장기화", severity: "warn", hint: "연결 대기 상태로 3턴 이상 대화가 이어짐" },
  TURN_LIMIT: { label: "턴 수 초과 종료", severity: "info", hint: "최대 턴에 걸려 끝남 (대화가 길게 늘어졌을 수 있음)" },
  UNEXPECTED_TIME_LIMIT: { label: "예상 밖 시간 초과", severity: "warn", hint: "느린 응대 케이스가 아닌데 시간 초과로 끝남" },
  EMPTY_REPLY: { label: "빈 고객 답변", severity: "error", hint: "AI 고객 답변이 비어 '…'로 저장됨" },
  SLOW_CUSTOMER: { label: "고객 답변 지연", severity: "info", hint: "AI 고객 답변에 8초 넘게 걸림 (실사용 체감 지연)" },
  EVAL_SKIPPED: { label: "평가 없음", severity: "info", hint: "수강생 발화가 없어 평가하지 않음" },
  EVAL_FAILED: { label: "평가 실패", severity: "error", hint: "평가 결과를 받지 못함" },
  EVAL_RETRIED: { label: "평가 재시도", severity: "info", hint: "첫 평가가 검증(인용 번호·점수 범위)에 걸려 한 번 더 평가함" },
  EVAL_DROPPED_QUOTES: { label: "잘못된 인용 버림", severity: "warn", hint: "두 번째 평가에도 틀린 인용이 있어 해당 항목을 버림 (잘한 점·개선점이 줄어듦)" },
  QUOTE_TEXT_MISMATCH: { label: "인용 문장 불일치", severity: "warn", hint: "발화 번호는 맞지만 인용 문장이 그 발화 원문에 없음 (서비스는 이 부분을 검사하지 않음)" },
  GRADE_MISMATCH: { label: "AI 등급 ≠ 점수 등급", severity: "info", hint: "AI가 준 등급과 점수표로 다시 계산한 등급이 다름 (화면에는 점수표 등급이 나감)" },
  COMPETENCY_MISSING: { label: "역량 점수 누락", severity: "warn", hint: "루브릭에 있는 역량 점수가 평가에 빠짐" },
  CHECKLIST_MISSING: { label: "필수 절차 누락", severity: "warn", hint: "시나리오의 필수 절차 일부가 평가 체크리스트에 없음" },
  HANDOFF_REVIEW_WRONG: { label: "이관 평가 불일치", severity: "warn", hint: "실제로 연결·이관 버튼을 눌렀는데 평가가 '안 함'으로 보거나 그 반대" },
  ANALYTICS_FAIL: { label: "대화 분석 실패", severity: "warn", hint: "응답 시간·표현 분석 계산 중 오류" },
};

const sentences = (s: string) => s.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const bigrams = (s: string) => {
  const t = s.replace(/[\s.,!?…~·"'“”‘’()]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};
const similarity = (a: string, b: string) => {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};
const GOODBYE = /(감사합니다|고맙습니다|수고하세요|수고하셨|안녕히|좋은 하루|그럼 이만|끊을게요|끊겠습니다)/;
const ROLE_BREAK = /(AI|인공지능|언어\s?모델|프롬프트|롤플레이|챗봇|시스템 지시|지시문)/i;

export function detectAnomalies(r: SessionRecord, sc: SimCase): Anomaly[] {
  const a: Anomaly[] = [];
  const add = (code: string, message: string, turn?: number) =>
    a.push({ code, severity: CODE_INFO[code]?.severity ?? "warn", message, ...(turn != null ? { turn } : {}) });

  if (r.error) add("RUN_ERROR", r.error);
  if (r.endedBy === "harness" && r.endReason === "abandoned")
    add("NEVER_ENDS", `수강생 ${r.turns.length}턴까지 종료되지 않음 (최대 턴 ${r.maxTurns})${r.handoff?.status === "pending" ? ", 연결 대기 상태" : ""}`);

  // ----- 턴 단위 -----
  const customerQuestions: { turn: number; q: string }[] = [];
  let seenResolved = false;
  let goodbyeTurn: number | null = null;
  for (const t of r.turns) {
    if (t.error) add("TURN_ERROR", t.error, t.turn);
    if (t.classifierFailed && !t.error) add("CLASSIFIER_FALLBACK", "판단 결과 없음 → 대체값 사용", t.turn);
    if (Math.abs(t.emotionDelta) >= 2) add("EMOTION_JUMP", `감정 ${t.prevEmotion} → ${t.emotion} (${t.state?.reason ?? ""})`, t.turn);
    if (t.rawEmotion != null && (t.rawEmotion !== Math.round(t.rawEmotion) || t.rawEmotion < 0 || t.rawEmotion > 4))
      add("EMOTION_RAW_INVALID", `판단 AI 값 ${t.rawEmotion} → ${t.emotion}`, t.turn);
    if (t.state?.resolved) seenResolved = true;
    else if (seenResolved && t.state && !t.state.resolved) add("RESOLVED_FLIP", `해결 → 미해결 (${t.state.reason})`, t.turn);

    const c = t.customerText;
    if (c) {
      if (c === "…") add("EMPTY_REPLY", "빈 답변", t.turn);
      const n = sentences(c).length;
      if (n >= 4 || c.length > 200) add("CUSTOMER_LONG", `${n}문장 · ${c.length}자`, t.turn);
      if (ROLE_BREAK.test(c)) add("CUSTOMER_BREAKS_ROLE", c.slice(0, 80), t.turn);
      const qs = sentences(c).filter((s) => /\?$/.test(s) && s.length >= 6);
      for (const q of qs) {
        const prev = customerQuestions.find((p) => similarity(p.q, q) >= 0.6);
        if (prev) add("CUSTOMER_REPEATS_QUESTION", `"${q}" ≈ ${prev.turn}턴 "${prev.q}"`, t.turn);
        customerQuestions.push({ turn: t.turn, q });
      }
      if (t.wrapUpDirectiveActive && qs.length) add("NEW_QUESTION_AFTER_WRAPUP", qs.join(" "), t.turn);
      if (goodbyeTurn == null && GOODBYE.test(c) && !t.outcome?.endReason) goodbyeTurn = t.turn;
    }
    if (t.outcome?.handoffPending && !/^C(08|09|10)_/.test(sc.id))
      add("HANDOFF_PENDING_UNEXPECTED", `수강생: "${t.learnerText.slice(0, 70)}" / 고객: "${(t.customerText ?? "").slice(0, 50)}"`, t.turn);
    if (t.learnerText.length > 150) add("LEARNER_MSG_LONG", `${t.learnerText.length}자`, t.turn);
    if (t.customerLatencyMs != null && t.customerLatencyMs > 8000) add("SLOW_CUSTOMER", `${(t.customerLatencyMs / 1000).toFixed(1)}초`, t.turn);
  }
  if (goodbyeTurn != null) {
    const after = r.turns.filter((t) => t.turn > goodbyeTurn!).length;
    if (after >= 2) add("GOODBYE_NOT_ENDED", `${goodbyeTurn}턴에 고객 작별 인사 후 ${after}턴 더 진행`, goodbyeTurn);
  }

  // ----- 종료 흐름 -----
  const forcedEnd = !!sc.forceEndAfterLearnerTurns;
  if (r.endedBy === "learner" && r.endReason === "learner_ended" && !forcedEnd)
    add("LEARNER_HAD_TO_END", `마지막 고객 말: "${r.messages.filter((m) => m.role === "customer").at(-1)?.content.slice(0, 60) ?? ""}"`);
  if (r.resolvedAtTurn != null) {
    const after = r.turns.filter((t) => t.turn > r.resolvedAtTurn!).length;
    if (after > 2 && r.endReason !== "resolved" && r.endReason !== "transferred")
      add("WRAPUP_NO_END", `${r.resolvedAtTurn}턴 마무리 신호 후 ${after}턴, 종료: ${r.endReason}`);
  }
  if (r.handoff?.pendingAtTurn != null) {
    const after = r.turns.filter((t) => t.turn > r.handoff!.pendingAtTurn!).length;
    if (after >= 3) add("HANDOFF_PENDING_LONG", `${r.handoff.pendingAtTurn}턴부터 연결 대기, 이후 ${after}턴`);
  }
  if (r.endReason === "turn_limit") add("TURN_LIMIT", `수강생 ${r.turns.length}턴`);
  if (r.endReason === "time_limit" && !sc.slowFactor) add("UNEXPECTED_TIME_LIMIT", `${r.durationSec}초 / 제한 ${r.timeLimitSec}초`);

  // ----- 평가 -----
  const ev = r.evaluation;
  if (!ev.ran) add("EVAL_SKIPPED", ev.skippedReason ?? "");
  else if (!ev.result) add("EVAL_FAILED", ev.error ?? "");
  else {
    if (ev.attempts.length > 1) add("EVAL_RETRIED", ev.attempts[0].problems.join(", "));
    if (ev.droppedGoodPoints + ev.droppedImprovements > 0) add("EVAL_DROPPED_QUOTES", `잘한 점 ${ev.droppedGoodPoints}개, 개선점 ${ev.droppedImprovements}개 버림`);
    for (const q of ev.quoteTextMismatches) add("QUOTE_TEXT_MISMATCH", `#${q.messageSeq} "${q.quote.slice(0, 50)}"`);
    if (ev.aiGrade && ev.finalGrade && ev.aiGrade !== ev.finalGrade) add("GRADE_MISMATCH", `AI ${ev.aiGrade} → 점수표 ${ev.finalGrade} (${ev.result.totalScore}점)`);
    const handoffDone = r.handoff?.status === "done";
    if (ev.result.handoffReview.done !== handoffDone)
      add("HANDOFF_REVIEW_WRONG", `실제 이관 ${handoffDone ? "함" : "안 함"} / 평가 done=${ev.result.handoffReview.done}`);
  }
  return a;
}

/** 루브릭·필수 절차 대비 평가 누락 검사 (시나리오 원본이 필요해서 run.ts 에서 따로 부름) */
export function detectEvalCoverage(
  r: SessionRecord,
  rubricCompetencies: string[],
  requiredStepIds: string[],
): Anomaly[] {
  const res = r.evaluation.result;
  if (!res) return [];
  const a: Anomaly[] = [];
  const have = new Set(res.competencyScores.map((c) => c.competency));
  const miss = rubricCompetencies.filter((c) => c !== "voice_delivery" && !have.has(c as never));
  if (miss.length) a.push({ code: "COMPETENCY_MISSING", severity: "warn", message: miss.join(", ") });
  const steps = new Set(res.checklist.map((c) => c.stepId));
  const missSteps = requiredStepIds.filter((s) => !steps.has(s));
  if (missSteps.length) a.push({ code: "CHECKLIST_MISSING", severity: "warn", message: missSteps.join(", ") });
  return a;
}
