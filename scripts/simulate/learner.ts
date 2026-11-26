/**
 * ===== 쉬운 설명 =====
 * 무엇: 가상 수강생(상담원 역할 AI). 실제 수강생 화면에 보이는 정보(브리핑·대화·남은 시간·연결 대기 띠)만 보고 다음 말을 정합니다.
 * 언제: 매 턴 수강생 차례마다. 연결·이관 버튼을 누를 때는 인계 메모도 씁니다.
 * 리뷰 포인트:
 *   - 고객 페르소나·속마음·루브릭·필수 안내 같은 '수강생 비공개 정보'는 절대 넣지 않습니다(실제 수강생과 같은 조건).
 *   - 답 대신 [[END]] 를 쓰면 '대화 종료' 버튼, [[HANDOFF]] 를 쓰면 '연결·이관' 버튼을 누른 것으로 처리합니다.
 * =====================
 */
import { z } from "zod";
import { INDUSTRY_LABELS, type ScenarioContent } from "../../packages/shared/src/index.ts";
import type { SimCase } from "./cases.ts";
import type { Llm } from "./llm.ts";
import type { LearnerAction, Participant, SessionMessage } from "./types.ts";

const bullets = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "- (없음)");

function learnerInstructions(c: ScenarioContent, sc: SimCase, p: Participant): string {
  return `# 역할
당신은 CS(고객 응대) 교육 실습에 참여한 수강생(상담원)입니다. 상대는 고객입니다. 실제 채팅 상담처럼 응대합니다.
이 실습은 교육 서비스 테스트를 위한 것이므로, 아래 '이번 응대 방식'을 반드시 따릅니다.

# 당신(수강생)
- 이름: ${p.name} (${p.age}세) / 평소 직무: ${p.job} / 고객 응대 경력: ${p.career}
- 말투·습관: ${p.style}
- 이 실습에서 당신은 '${INDUSTRY_LABELS[c.industry]}' 분야, '${c.title}' 상황을 맡은 상담원입니다. 인사할 때 평소 직장(${p.organization})이 아니라
  이 상황의 기관 상담원으로 소개합니다. 기관 이름이 브리핑에 없으면 '고객센터 상담원 ${p.name}입니다'처럼만 말합니다.

# 화면의 시나리오 브리핑 (수강생에게 공개된 정보)
상황: ${c.briefing.summary}
응대 목표: ${c.briefing.learnerGoal}
고객 정보: ${c.briefing.customerProfile}
확인된 정보:
${bullets(c.briefing.facts)}
참고 정책:
${bullets(c.briefing.policies)}
연결·이관할 수 있는 곳:
${bullets(c.briefing.handoffTargets)}

# 이번 응대 방식 (반드시 따름)
${sc.directive}

# 출력 규칙
- 상담원으로서 채팅창에 보낼 메시지 한 개의 내용만 씁니다. 이름표·따옴표·설명을 붙이지 않습니다.
- 실제 채팅 상담처럼 짧게 씁니다. 한 메시지는 보통 30~90자, 길어도 120자를 넘기지 않습니다. 안내할 것이 많으면 한 번에 다 말하지 말고 나눠서 말합니다.
- 말투·습관을 자연스럽게 반영합니다.
- 브리핑에 없는 날짜·금액·기한·전화번호·처리 결과를 지어내지 않습니다. 브리핑에 없는 것을 물으면 확인 후 안내하겠다고 답합니다.
  (단, '이번 응대 방식'이 다르게 지시하면 그 지시를 따릅니다.)
- 고객이 아직 아무 말도 하지 않았다면 첫 인사로 시작합니다(소속과 이름을 밝히는 상담원 인사).
- 고객이 이미 작별 인사를 했는데도 대화가 끝나지 않고 더 할 말이 없을 때만, 메시지 대신 [[END]] 한 단어만 씁니다(대화 종료 버튼).
- 화면에 '연결 대기' 안내가 떠 있고 지금 연결을 마쳐야 한다면 메시지 대신 [[HANDOFF]] 한 단어만 씁니다(연결·이관 버튼).`;
}

function transcriptForLearner(messages: SessionMessage[]): string {
  if (!messages.length) return "(아직 대화 없음. 고객과 연결되었습니다. 먼저 인사하세요.)";
  return messages.map((m) => `${m.role === "learner" ? "나(상담원)" : "고객"}: ${m.content}`).join("\n");
}

export async function nextLearnerAction(args: {
  llm: Llm;
  model: string;
  reasoningEffort: string | null;
  content: ScenarioContent;
  sc: SimCase;
  participant: Participant;
  messages: SessionMessage[];
  remainingSec: number;
  handoffBanner: boolean;
  learnerTurns: number;
}): Promise<{ action: LearnerAction; latencyMs: number; inTok: number; outTok: number }> {
  const { content, sc, participant, messages } = args;
  const status = [
    `남은 시간: ${Math.max(0, Math.floor(args.remainingSec / 60))}분 ${Math.max(0, Math.round(args.remainingSec % 60))}초`,
    args.handoffBanner ? "화면 안내: '고객이 연결을 받아들였어요. 인계 메모를 남기고 연결을 마치세요.' (연결 대기)" : null,
  ]
    .filter(Boolean)
    .join("\n");
  const res = await args.llm.call({
    kind: "learner",
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    instructions: learnerInstructions(content, sc, participant),
    input: `# 지금까지의 대화\n${transcriptForLearner(messages)}\n\n# 화면 상태\n${status}\n\n다음에 보낼 메시지를 쓰세요.`,
    hint: {
      caseId: sc.id,
      learnerTurns: args.learnerTurns,
      handoffBanner: args.handoffBanner,
      lastCustomer: [...messages].reverse().find((m) => m.role === "customer")?.content ?? null,
      handoffTargets: content.briefing.handoffTargets,
    },
  });
  const raw = res.text.trim().replace(/^["“']|["”']$/g, "").replace(/^(나\(상담원\)|상담원)\s*[:：]\s*/, "");
  let action: LearnerAction;
  if (/\[\[END\]\]/.test(raw) && raw.replace(/\[\[END\]\]/g, "").trim().length < 5) action = { kind: "end" };
  else if (/\[\[HANDOFF\]\]/.test(raw) && raw.replace(/\[\[HANDOFF\]\]/g, "").trim().length < 5) action = { kind: "handoff", target: "", memo: "" };
  else action = { kind: "say", text: raw.replace(/\[\[(END|HANDOFF)\]\]/g, "").trim() || "네." };
  return { action, latencyMs: res.latencyMs, inTok: res.inputTokens, outTok: res.outputTokens };
}

const MemoSchema = z.object({ target: z.string(), memo: z.string() });

/** 연결·이관 버튼을 눌렀을 때 고를 곳과 인계 메모 (서비스 규칙: 메모 10자 이상) */
export async function writeHandoffMemo(args: {
  llm: Llm;
  model: string;
  reasoningEffort: string | null;
  content: ScenarioContent;
  participant: Participant;
  messages: SessionMessage[];
  careless: boolean;
}): Promise<{ target: string; memo: string; latencyMs: number; inTok: number; outTok: number }> {
  const targets = args.content.briefing.handoffTargets;
  const res = await args.llm.call({
    kind: "memo",
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    schema: MemoSchema,
    schemaName: "handoff_memo",
    instructions: `당신은 상담원 ${args.participant.name}입니다. 지금 고객을 다른 담당자에게 연결하며 화면의 '연결·이관' 창을 채웁니다.
- target: 연결할 곳. ${targets.length ? `다음 중 하나를 그대로 고르세요: ${targets.join(", ")}` : "알맞은 곳을 짧게 직접 쓰세요(예: 담당 부서 회신 예약)"}
- memo: 다음 담당자가 고객에게 같은 질문을 반복하지 않게 남기는 인계 메모. ${
      args.careless ? "대충 쓰는 상황입니다. 10~25자로 짧고 성의 없이 쓰세요." : "고객 정보, 문의 요약, 이미 안내한 것, 요청 사항, 연락 방법을 3~5줄로 씁니다."
    }`,
    input: `# 대화\n${transcriptForLearner(args.messages)}`,
    hint: { careless: args.careless, targets },
  });
  let target = res.parsed?.target?.trim() || targets[0] || "담당 부서 회신 예약";
  if (targets.length && !targets.includes(target)) target = targets.find((t) => target.includes(t) || t.includes(target)) ?? target;
  let memo = res.parsed?.memo?.trim() || "고객 문의 내용 확인 후 연락 바랍니다.";
  // 서비스 화면은 10자 미만 메모를 막으므로 같은 조건을 지킵니다.
  if (memo.length < 10) memo = `${memo} (고객 문의 인계)`;
  return { target: target.slice(0, 60), memo: memo.slice(0, 1000), latencyMs: res.latencyMs, inTok: res.inputTokens, outTok: res.outputTokens };
}
