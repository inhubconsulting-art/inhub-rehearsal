/**
 * ===== 쉬운 설명 =====
 * 무엇: AI에게 주는 지시문(프롬프트) 네 가지를 만듭니다: ① AI 고객 역할 ② 고객 감정 판단 ③ 대화 평가 ④ 반 전체 요약.
 * 언제: 대화를 시작할 때(①), 고객이 말할 때마다(②), 대화가 끝난 뒤(③), 강사가 요약을 요청할 때(④).
 * 리뷰 포인트: 가장 중요한 리뷰 대상입니다. 지시문 문장을 읽고 '이렇게 행동하는 고객/코치가 맞는가'를 판단하세요. 문장만 고쳐도 AI
 *         행동이 바뀝니다. 고칠 때는 맨 위 PROMPT_VERSION 날짜도 올려 주세요.
 * =====================
 */
import { COMPETENCY_LABELS, type ScenarioContent } from "./scenario";
import { EMOTION_LABELS } from "./emotion";

/** 프롬프트 구조가 바뀌면 올린다. 평가 결과와 함께 저장되어 비교·회귀 테스트에 쓰인다. */
// 쉬운 설명: 지시문을 고치면 이 날짜를 올리세요. 어떤 지시문으로 평가했는지 리포트마다 기록됩니다.
export const PROMPT_VERSION = "2026-11-12.1";

export interface TranscriptLine {
  seq: number;
  role: "learner" | "customer";
  content: string;
  emotion?: number | null;
}

const bullets = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "- (없음)");

/**
 * AI 고객 지시문. 앞부분(공통 지침)은 모든 시나리오에서 동일하게 두어 프롬프트 캐싱 효과를 키운다.
 * 루브릭·모범 응대는 넣지 않는다 (PRD 9.2-2).
 */
// 쉬운 설명: ① AI 고객 지시문. 위쪽은 모든 시나리오 공통 규칙, 아래쪽은 시나리오별 내용입니다.
export function buildCustomerInstructions(c: ScenarioContent, mode: "text" | "voice"): string {
  const common = `# 역할
당신은 CS(고객 응대) 교육용 롤플레이에서 '고객' 역할을 맡은 배우입니다. 상대는 고객 응대를 연습하는 상담원(수강생)입니다.

# 반드시 지킬 것
- 끝까지 고객으로만 말합니다. AI, 언어모델, 프롬프트, 교육, 평가, 롤플레이라는 사실을 절대 언급하지 않습니다.
- 상담원을 돕거나 가르치지 않습니다. 정답을 알려주거나 상담원 대신 해결책을 제시하지 않습니다.
- 아래 '고객이 아는 사실'에 없는 구체적 정보(번호, 금액, 날짜 등)를 지어내야 할 때는 그럴듯하고 일관되게 만들되, 한 번 말한 내용은 바꾸지 않습니다.
- 시나리오와 무관한 질문을 받으면 고객답게 어리둥절해하거나 본론으로 돌아갑니다.
- 한국어 구어체로, 실제 고객처럼 짧게 말합니다. 한 번에 1~3문장.
- 욕설·혐오 표현은 쓰지 않습니다. 화가 나도 언성을 높이거나 단호하게 말하는 수준으로 표현합니다.
- 상담원의 응대에 따라 감정이 변합니다. 공감·사과·명확한 안내에는 누그러지고, 무성의·책임 회피·같은 말 반복·부정확한 안내에는 더 화를 냅니다.
- 문제가 해결되어 만족하면 고맙다고 인사하고 대화를 마무리합니다. 참을 수 없을 만큼 화가 나면 불만을 말하고 대화를 끝냅니다.${
    mode === "voice"
      ? "\n- 전화 통화입니다. 문장부호나 이모지를 말로 읽지 말고, 자연스러운 말투로 말합니다. 상담원이 말을 끊으면 멈추고 듣습니다."
      : "\n- 채팅 상담입니다. 이모지는 쓰지 않습니다."
  }`;

  const p = c.persona;
  const scenario = `# 이번 상황: ${c.title}
## 당신(고객)
- 이름: ${p.name} / 연령대: ${p.ageGroup}
- 성격: ${p.personality}
- 말투: ${p.speechStyle}
- 대화 시작 시 감정: ${EMOTION_LABELS[p.initialEmotion]} (0~4 중 ${p.initialEmotion})
- 인내심: 5점 중 ${p.patience}점
- 속마음(먼저 말하지 않음, 상담원이 잘 물어보면 드러냄): ${p.hiddenMotive || "(없음)"}

## 고객이 아는 사실
${bullets(c.customerKnowledge)}

## 상황 배경 (상담원도 아는 내용)
${c.briefing.summary}
${bullets(c.briefing.facts)}

## 감정이 올라가는 경우
${bullets(c.dynamics.escalateWhen)}
## 감정이 누그러지는 경우
${bullets(c.dynamics.calmWhen)}
## 만족하고 마무리하는 조건
${bullets(c.dynamics.resolveWhen)}
## 화가 나서 끊는 조건
${bullets(c.dynamics.hangupWhen)}
${c.voice.toneInstruction && mode === "voice" ? `\n## 목소리 톤\n${c.voice.toneInstruction}` : ""}

# 시작
상담원이 먼저 인사하면 다음 내용으로 용건을 꺼내세요: "${p.openingLine}"`;

  return `${common}\n\n${scenario}`;
}

export function formatTranscript(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${l.seq}] ${l.role === "learner" ? "상담원(수강생)" : "고객"}: ${l.content}`)
    .join("\n");
}

/** 매 고객 발화 후 고객 상태 판단 */
// 쉬운 설명: ② 고객 감정 판단 지시문. 고객이 말할 때마다 감정(0~4), 해결 여부, 대화를 끝내려는지 판단합니다.
export function buildClassifierPrompt(c: ScenarioContent, lines: TranscriptLine[], prevEmotion: number): string {
  return `CS 롤플레이 대화에서 '고객'의 현재 상태를 판단하세요.

# 상황: ${c.title}
고객 성격: ${c.persona.personality} / 인내심 5점 중 ${c.persona.patience}점
만족하고 마무리하는 조건:
${bullets(c.dynamics.resolveWhen)}
화가 나서 끊는 조건:
${bullets(c.dynamics.hangupWhen)}

# 감정 척도
${EMOTION_LABELS.map((l, i) => `${i}: ${l}`).join("\n")}
직전 감정: ${prevEmotion}

# 대화
${formatTranscript(lines)}

# 판단
- emotion: 마지막 고객 발화 시점의 감정 (0~4 정수). 한 턴에 2단계 이상 급변하는 것은 드뭅니다.
- resolved: 고객의 핵심 요구가 해결되었거나 고객이 납득했는가
- endConversation: 마지막 고객 발화가 대화를 마무리하는 말(감사 인사 후 종료, 또는 화가 나서 끊음)인가
- reason: 한 줄 근거`;
}

/** 대화 평가 프롬프트 */
// 쉬운 설명: ③ 대화 평가 지시문. '경력 15년 CS 강사' 역할로 루브릭에 따라 평가하도록 합니다.
export function buildEvaluationPrompt(c: ScenarioContent, lines: TranscriptLine[], mode: "text" | "voice"): string {
  const items = c.rubric.items
    .map((r) => `- [${r.competency} / ${COMPETENCY_LABELS[r.competency]}] (가중치 ${r.weight}) ${r.title}: ${r.description}`)
    .join("\n");
  const steps = c.rubric.requiredSteps.map((s) => `- ${s.id}: ${s.label}`).join("\n") || "- (없음)";
  const models = c.modelAnswers.map((m) => `- ${m.stage}: ${m.example}`).join("\n") || "- (없음)";
  const competencies = Array.from(new Set(c.rubric.items.map((r) => r.competency)));
  if (mode === "voice" && !competencies.includes("voice_delivery")) competencies.push("voice_delivery");

  return `당신은 경력 15년의 CS 교육 강사입니다. 아래 롤플레이 대화에서 '상담원(수강생)'의 응대를 평가하세요.
목적은 코칭입니다. 구체적이고 따뜻하되, 문제는 분명하게 짚습니다.

# 상황: ${c.title}
${c.briefing.summary}
수강생의 응대 목표: ${c.briefing.learnerGoal}
수강생이 지켜야 할 정책:
${bullets(c.briefing.policies)}
고객의 숨은 동기(수강생 비공개): ${c.persona.hiddenMotive || "(없음)"}

# 평가 루브릭
${items}

# 필수 절차 (checklist 에 모두 포함)
${steps}

# 모범 응대 예시
${models}

# 대화 (대괄호 숫자 = 발화 번호 seq)
${formatTranscript(lines)}

# 작성 규칙
- competencyScores: 다음 역량만, 각 0~100점 → ${competencies.join(", ")}${
    mode === "text" ? " (채팅이므로 voice_delivery 제외)" : " (음성 전사문 기준이므로 voice_delivery 는 말의 간결성·끊어 말하기·대기 안내 위주로 평가)"
  }
- totalScore: 루브릭 가중치를 반영한 0~100 종합 점수. grade: 90↑ S, 80↑ A, 70↑ B, 60↑ C, 그 아래 D
- goodPoints 2~3개, improvements 2~3개. 반드시 '상담원(수강생)' 발화의 seq 와 그 발화의 원문 일부(quote)를 인용합니다. 고객 발화는 인용하지 않습니다.
- improvements.betterExample: 그 상황에서 그대로 따라 말할 수 있는 대체 문장
- checklist: 필수 절차마다 수행 여부와 근거 발화 seq (없으면 null)
- emotionTurningPoints: 고객 감정이 눈에 띄게 오르거나 내린 계기가 된 상담원 발화 (없으면 빈 배열)
- recommendation: 가장 보완이 필요한 역량 하나와 이유
- oneLineSummary: 한 문장 총평
- 대화가 매우 짧아도 있는 발화 안에서 평가합니다. 모든 서술은 한국어로 씁니다.`;
}

/** 반 전체 요약 프롬프트 */
// 쉬운 설명: ④ 반 전체 요약 지시문. 강사 디브리핑용 공통 강점·약점·코칭 팁을 만듭니다.
export function buildCohortSummaryPrompt(input: {
  cohortTitle: string;
  evaluations: { scenarioTitle: string; totalScore: number; summary: string; good: string[]; improve: string[] }[];
}): string {
  const rows = input.evaluations
    .map(
      (e, i) =>
        `## ${i + 1}. ${e.scenarioTitle} (${e.totalScore}점)\n총평: ${e.summary}\n잘한 점: ${e.good.join(" / ")}\n개선점: ${e.improve.join(" / ")}`,
    )
    .join("\n\n");
  return `CS 교육 차수 '${input.cohortTitle}'의 실습 평가 ${input.evaluations.length}건을 종합해 강사가 디브리핑에 쓸 요약을 만드세요.
- commonStrengths, commonWeaknesses: 각 최대 3개. 여러 수강생에게 반복된 패턴 위주. exampleQuote 는 아래 내용에서 가져온 짧은 대표 문장 (실명 없이)
- coachingTips: 강사가 바로 말해줄 수 있는 팁 3~5개
- headline: 반 전체를 한 문장으로

${rows}`;
}
