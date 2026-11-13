/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 리포트 화면. 평가가 아직이면 '분석 중' 대기 화면, 끝나면 리포트를 보여줍니다.
 * 언제: 대화가 끝난 직후, 또는 연습 기록에서 다시 볼 때.
 * 리뷰 포인트: '같은 시나리오 다시 도전' 버튼이 실습 중일 때만 보이는지 확인하세요.
 * =====================
 */
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { loadReport } from "@/lib/report";
import { AppShell } from "@/components/AppShell";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ReportView } from "@/components/report/ReportView";
import { ReportWaiting } from "@/components/report/ReportWaiting";
import { PrintButton } from "@/components/PrintButton";
import { fmtDateTime } from "@/lib/format";

export default async function LearnerReport({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const u = await requirePageUser();
  const r = await loadReport(u, sessionId).catch(() => null);
  if (!r) redirect("/learn");
  if (r.session.status === "active") redirect(`/learn/session/${sessionId}`);

  return (
    <AppShell user={u}>
      <PageHeader
        title="응대 리포트"
        description={`${r.content.title} · ${fmtDateTime(r.session.started_at)}`}
        actions={
          <div className="no-print flex gap-2">
            {r.evaluation && <PrintButton />}
            {r.cohort.status === "running" && (
              <LinkButton href={`/learn/${r.cohort.id}/scenarios/${r.session.scenario_id}`} variant="secondary">
                같은 시나리오 다시 도전
              </LinkButton>
            )}
            <LinkButton href={`/learn?cohort=${r.cohort.id}`}>시나리오 목록</LinkButton>
          </div>
        }
      />
      {r.evaluation ? (
        <ReportView r={r} />
      ) : r.session.status === "failed" ? (
        <EmptyState title="평가를 만들지 못했습니다.">
          대화 내용이 너무 짧거나 일시적인 오류가 발생했습니다. 같은 시나리오로 다시 연습해 주세요.
        </EmptyState>
      ) : (
        <ReportWaiting sessionId={sessionId} />
      )}
    </AppShell>
  );
}
