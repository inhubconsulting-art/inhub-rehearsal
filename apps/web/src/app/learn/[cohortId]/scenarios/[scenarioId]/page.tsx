/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 브리핑 화면. 상황·고객·응대 목표·정책을 보여주고, 오른쪽에서 대화 방식을 고릅니다.
 * 언제: 수강생이 시나리오 카드의 '시작하기'를 눌렀을 때.
 * 리뷰 포인트: 브리핑에 수강생이 알면 안 되는 정보(숨은 동기, 평가 기준)가 나오지 않는지 확인하세요.
 * =====================
 */
import { notFound, redirect } from "next/navigation";
import { toLearnerView } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { getCohort, getCohortScenarios, getEnrollment, loadScenarioContent } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader } from "@/components/ui";
import { BriefingCard } from "@/components/learner/BriefingCard";
import { StartScenario } from "@/components/learner/StartScenario";

export default async function ScenarioBriefing({
  params,
}: {
  params: Promise<{ cohortId: string; scenarioId: string }>;
}) {
  const { cohortId, scenarioId } = await params;
  const u = await requirePageUser();
  const enrollment = await getEnrollment(cohortId, u.id);
  if (!enrollment) redirect("/learn");
  const cohort = await getCohort(cohortId);
  const cs = (await getCohortScenarios(cohortId)).find((x) => x.scenario_id === scenarioId);
  if (!cs) notFound();
  const content = await loadScenarioContent(scenarioId, cs.scenario_version);
  const view = toLearnerView(content);
  const minutes = Math.round((cohort.time_limit_sec ?? content.timeLimitSec) / 60);

  return (
    <AppShell user={u}>
      <PageHeader title={view.title} description={`제한 시간 ${minutes}분 · 최대 ${view.maxTurns}턴`} />
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <BriefingCard view={view} />
        </Card>
        <Card className="h-fit">
          <StartScenario
            cohortId={cohortId}
            scenarioId={scenarioId}
            allowedModes={cohort.allowed_modes}
            channel={view.channel}
            running={cohort.status === "running"}
          />
        </Card>
      </div>
    </AppShell>
  );
}
