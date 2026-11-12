/**
 * ===== 쉬운 설명 =====
 * 무엇: 새 시나리오 화면의 입구. 빈 양식의 기본값(평가 항목 3개 등)이 여기 있습니다.
 * 언제: '새 시나리오' 버튼.
 * 리뷰 포인트: 새 시나리오의 기본 평가 항목이 적절한지 확인하세요.
 * =====================
 */
import type { ScenarioContent } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { ScenarioEditor } from "@/components/admin/ScenarioEditor";

const BLANK: ScenarioContent = {
  title: "",
  industry: "public",
  type: "complaint",
  difficulty: "medium",
  channel: "phone",
  timeLimitSec: 600,
  maxTurns: 25,
  showEmotionToLearner: false,
  briefing: { summary: "", learnerGoal: "", customerProfile: "", facts: [], policies: [] },
  persona: {
    name: "",
    ageGroup: "",
    personality: "",
    speechStyle: "",
    initialEmotion: 1,
    hiddenMotive: "",
    patience: 3,
    openingLine: "",
  },
  customerKnowledge: [],
  dynamics: { escalateWhen: [], calmWhen: [], resolveWhen: [], hangupWhen: [] },
  rubric: {
    items: [
      { id: "r1", competency: "greeting_procedure", title: "첫인사와 본인 확인", description: "", weight: 1 },
      { id: "r2", competency: "empathy", title: "공감", description: "", weight: 1 },
      { id: "r3", competency: "problem_solving", title: "해결책 제시", description: "", weight: 1 },
    ],
    requiredSteps: [],
  },
  modelAnswers: [],
  voice: { voice: "marin", toneInstruction: "" },
};

export default async function NewScenario() {
  const u = await requirePageUser(["admin"]);
  return (
    <AppShell user={u}>
      <PageHeader title="새 시나리오" />
      <ScenarioEditor initial={BLANK} />
    </AppShell>
  );
}
