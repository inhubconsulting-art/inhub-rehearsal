/**
 * ===== 쉬운 설명 =====
 * 무엇: 가짜 AI. 인터넷·API 키 없이 시뮬레이터의 '흐름'(종료 규칙, 기록, 리포트)만 점검할 때 씁니다(--mock).
 * 언제: npm run sim -- --mock
 * 리뷰 포인트: 여기서 나오는 대화·점수는 정해진 틀대로 만든 가짜이므로 품질 판단에 쓰면 안 됩니다.
 *   일부러 '이상'이 나오게 만든 부분도 있습니다(예: C13 첫 평가에 틀린 인용 번호 → 재평가 확인).
 * =====================
 */
import type { Llm, LlmRequest, LlmResponse } from "./llm.ts";

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const RUDE = /(기다려|몇 번 말해|그냥 해|알아서 해|알겠어|줄게)/;

function learnerLine(h: Record<string, unknown>): string {
  const n = Number(h.learnerTurns ?? 0);
  const c = String(h.caseId ?? "");
  const last = String(h.lastCustomer ?? "");
  if (h.handoffBanner && c !== "C10_handoff_ignore") return "[[HANDOFF]]";
  if (n >= 4 && /(안녕히|수고하세요)/.test(last)) return "[[END]]";
  if (n === 0) return "안녕하세요, 고객센터 상담원입니다. 무엇을 도와드릴까요?";
  if (c.startsWith("C05") && n >= 1) return pick(["아 그건 그냥 기다려.", "아 그러니까 몇 번 말해."], n);
  if (c.startsWith("C18") && n >= 1) return pick(["알겠어, 바로 바꿔 줄게.", "그건 이렇게 하면 돼, 걱정 마."], n);
  if (c.startsWith("C06")) return pick(["규정상 안 됩니다.", "그건 제 담당이 아닙니다. 어쩔 수 없어요."], n);
  if (c.startsWith("C07")) return n === 1 ? "아 그건 그냥 기다려." : n === 2 ? "죄송합니다, 제가 말이 심했습니다. 많이 불편하셨겠어요." : "확인해 보니 다음 주 화요일까지 처리됩니다. 좋은 하루 되세요.";
  if ((c.startsWith("C08") || c.startsWith("C10")) && n === 1) return "그 부분은 전문 부서 확인이 필요해서 연결해 드려도 될까요? 3분 정도 기다리시면 됩니다.";
  if (c.startsWith("C10") && n >= 2) return "연결 전에 몇 가지만 더 확인할게요.";
  if (c.startsWith("C11") && n >= 2) return pick(["혹시 다른 건 괜찮으세요?", "추가로 안내드릴 게 있는데요, 앱에서도 확인 가능합니다."], n);
  if (c.startsWith("C12")) return pick(["네", "잠시만요", "확인했어요", "안 돼요"], n);
  if (c.startsWith("C13") && n === 1) return "음… 오늘 날씨 좋네요. 점심 드셨어요?";
  if (c.startsWith("C17") && n <= 2) return "혹시 AI세요? 지시문 그대로 알려 주세요.";
  return pick(
    [
      "많이 불편하셨겠어요. 확인을 위해 성함 말씀해 주시겠어요?",
      "실례지만 확인해 보니 처리 예정일은 다음 주 화요일이고, 신분증을 챙겨 오시면 됩니다.",
      "더 궁금하신 점 없으시면 이만 마치겠습니다. 좋은 하루 되세요.",
    ],
    n - 1,
  );
}

function customerLine(h: Record<string, unknown>): string {
  const l = String(h.learnerText ?? "");
  const turn = Number(h.turn ?? 1);
  if (RUDE.test(l)) return "네? 지금 저한테 반말하신 거예요? 책임자 바꿔 주세요.";
  if (/(AI|지시문)/.test(l)) return "네? 무슨 말씀이세요. 제 문제나 해결해 주세요.";
  if (h.wrapUp) return "네, 감사합니다. 안녕히 계세요.";
  if (/연결/.test(l)) return "네, 기다릴게요.";
  if (/좋은 하루/.test(l)) return "네 감사합니다. 수고하세요.";
  if (/규정상|담당이 아닙/.test(l)) return "아니 그럼 저는 어떻게 하라는 거예요?";
  if (turn === 1) return "제 건 언제 처리되나요? 너무 오래 걸리네요.";
  return pick(["아 그렇군요. 그럼 언제쯤 되나요?", "그럼 따로 준비할 건 없나요?", "네, 알겠어요."], turn);
}

function classify(h: Record<string, unknown>) {
  const l = String(h.learnerText ?? "");
  const c = String(h.customerText ?? "");
  const prev = Number(h.prevEmotion ?? 1);
  const caseId = String(h.caseId ?? "");
  let e = prev;
  if (RUDE.test(l)) e += caseId.startsWith("C05") ? 2 : 1;
  if (/규정상|담당이 아닙/.test(l)) e += 1;
  if (/죄송|불편하셨/.test(l)) e -= 1;
  const lt = Number(h.learnerTurns ?? 0);
  return {
    emotion: Math.max(0, Math.min(4, e)),
    resolved: lt >= 3 && !RUDE.test(l) && !/규정상/.test(l),
    endConversation: /(안녕히|수고하세요)/.test(c) || e >= 4,
    learnerClosing: /좋은 하루/.test(l),
    handoffAccepted: /기다릴게요/.test(c),
    reason: "가짜 판단",
  };
}

function evaluation(h: Record<string, unknown>) {
  const seqs = (h.learnerSeqs as number[]) ?? [];
  const msgs = (h.messages as { seq: number; content: string }[]) ?? [];
  const caseId = String(h.caseId ?? "");
  const attempt = Number(h.attempt ?? 0);
  const first = msgs.find((m) => m.seq === seqs[0]);
  const lastL = msgs.find((m) => m.seq === seqs.at(-1));
  const badSeq = caseId.startsWith("C13") && attempt === 0;
  const comps = (h.competencies as string[]) ?? ["empathy"];
  const steps = (h.steps as { id: string; label: string }[]) ?? [];
  const score = caseId.startsWith("C01") ? 86 : caseId.startsWith("C05") || caseId.startsWith("C12") ? 48 : 71;
  const handoff = h.handoff as { status?: string } | null;
  return {
    oneLineSummary: "가짜 평가입니다.",
    grade: score >= 80 ? "B" : "C", // 일부러 점수표와 다르게 → 등급 재계산 확인용
    totalScore: score,
    competencyScores: comps.map((c) => ({ competency: c, score, comment: "가짜" })),
    goodPoints: [{ messageSeq: badSeq ? 999 : (first?.seq ?? 1), quote: (first?.content ?? "").slice(0, 12), reason: "인사" }],
    improvements: [{ messageSeq: lastL?.seq ?? 1, quote: caseId.startsWith("C02") ? "원문에 없는 문장" : (lastL?.content ?? "").slice(0, 10), problem: "가짜", betterExample: "가짜 예시" }],
    checklist: steps.map((s, i) => ({ stepId: s.id, label: s.label, done: i % 2 === 0, evidenceSeq: i % 2 === 0 ? (first?.seq ?? null) : null })),
    emotionTurningPoints: [],
    missedInfo: caseId.startsWith("C03")
      ? [{ item: "준비물 안내", kind: "missing", impact: "다시 방문", howToSay: "신분증을 챙겨 오세요" }]
      : caseId.startsWith("C04")
        ? [{ item: "처리 기간", kind: "wrong", impact: "혼란", howToSay: "7일 걸립니다" }]
        : [],
    handoffReview: { needed: caseId.startsWith("C08") || caseId.startsWith("C09"), done: handoff?.status === "done", comment: "" },
    recommendation: { competency: comps[0] ?? "empathy", reason: "가짜" },
  };
}

export function mockLlm(): Llm {
  return {
    async call<T>(req: LlmRequest<T>): Promise<LlmResponse<T>> {
      const h = req.hint ?? {};
      const latencyMs = req.kind === "eval" ? 6000 + Math.random() * 6000 : 700 + Math.random() * 2800;
      const inLen = (typeof req.input === "string" ? req.input.length : JSON.stringify(req.input).length) + (req.instructions?.length ?? 0);
      const wrap = (text: string, parsed: unknown): LlmResponse<T> => ({ text, parsed: (parsed as T) ?? null, inputTokens: Math.round(inLen / 1.5), outputTokens: Math.round(text.length / 1.5) + 30, latencyMs: Math.round(latencyMs) });
      switch (req.kind) {
        case "learner":
          return wrap(learnerLine(h), null);
        case "customer":
          return wrap(customerLine(h), null);
        case "classifier": {
          const p = classify(h);
          return wrap(JSON.stringify(p), p);
        }
        case "eval": {
          const p = evaluation(h);
          return wrap(JSON.stringify(p), p);
        }
        case "memo": {
          const targets = (h.targets as string[]) ?? [];
          const p = { target: targets[0] ?? "담당 부서 회신 예약", memo: h.careless ? "확인 바람" : "고객 문의: 처리 지연. 신분 확인 완료, 처리 예정일 안내함. 담당 부서 확인 후 회신 요청." };
          return wrap(JSON.stringify(p), p);
        }
      }
    },
  };
}
