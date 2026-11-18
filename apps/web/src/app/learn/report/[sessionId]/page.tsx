/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 리포트 화면. 평가가 아직이면 '분석 중' 대기 화면, 끝나면 리포트를 보여줍니다.
 * 언제: 대화가 끝난 직후, 또는 연습 기록에서 다시 볼 때.
 * 리뷰 포인트: '같은 시나리오 다시 도전' 버튼이 실습 중일 때만 보이는지 확인하세요.
 *         리포트를 본 시간·스크롤(ReportTracker), 평가 동의 👍/👎·현실감 점수(ReportFeedback)를 기록합니다.
 *         기다리는 동안에는 '실제 고객과 얼마나 비슷했나요?'를 먼저 묻습니다.
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
import { loadSessionFeedback } from "@/lib/events";
import { ReportTracker } from "@/components/tracking/ReportTracker";
import { RealismRating, ReportFeedback } from "@/components/report/ReportFeedback";

export default async function LearnerReport({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const u = await requirePageUser();
  const r = await loadReport(u, sessionId).catch(() => null);
  if (!r) redirect("/learn");
  if (r.session.status === "active") redirect(`/learn/session/${sessionId}`);
  // 쉬운 설명: 이미 답한 👍/👎·현실감 점수가 있으면 그 상태로 보여 줌 (표가 아직 없으면 빈 값)
  const fb = await loadSessionFeedback(u.id, sessionId).catch(() => ({ agree: null, realism: null }));

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
        <>
          <ReportView r={r} />
          <div className="mt-5">
            <ReportFeedback sessionId={sessionId} initialAgree={fb.agree} initialRealism={fb.realism} />
          </div>
          <ReportTracker sessionId={sessionId} />
        </>
      ) : r.session.status === "failed" ? (
        <EmptyState title="평가를 만들지 못했습니다.">
          대화 내용이 너무 짧거나 일시적인 오류가 발생했습니다. 같은 시나리오로 다시 연습해 주세요.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <ReportWaiting sessionId={sessionId} />
          <RealismRating sessionId={sessionId} initial={fb.realism} />
        </div>
      )}
    </AppShell>
  );
}
