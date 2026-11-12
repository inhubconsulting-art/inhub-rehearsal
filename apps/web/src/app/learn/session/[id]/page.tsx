/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 화면의 입구. 대화에 필요한 정보(시나리오, 지금까지의 발화, 남은 시간)를 준비해 대화 화면 부품에 넘깁니다.
 * 언제: '고객 연결하기'를 누른 직후, 또는 진행 중인 대화로 돌아올 때.
 * 리뷰 포인트: 이미 끝난 대화로 들어오면 리포트로 보내는지 정도만 보면 됩니다.
 * =====================
 */
import { redirect } from "next/navigation";
import { toLearnerView } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { effectiveTimeLimit, getCohort, getMessages, getOwnSession, loadScenarioContent } from "@/lib/domain";
import { Conversation } from "@/components/learner/Conversation";
import { CohortLive } from "@/components/learner/CohortLive";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser();
  const session = await getOwnSession(u, id).catch(() => null);
  if (!session) redirect("/learn");
  if (session.status !== "active") redirect(`/learn/report/${session.id}`);

  const cohort = await getCohort(session.cohort_id);
  const content = await loadScenarioContent(session.scenario_id, session.scenario_version);
  const messages = await getMessages(session.id);

  return (
    <>
      <CohortLive cohortId={cohort.id} userId={u.id} name={u.profile.name} activity="대화 중" />
      <Conversation
        sessionId={session.id}
        mode={session.mode}
        allowText={cohort.allowed_modes.includes("text")}
        view={toLearnerView(content)}
        initialMessages={messages.map((m) => ({ seq: m.seq, role: m.role, content: m.content }))}
        startedAt={session.started_at}
        timeLimitSec={effectiveTimeLimit(cohort, content)}
        initialEmotion={session.current_emotion ?? content.persona.initialEmotion}
      />
    </>
  );
}
