/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사용 대화 상세. 진행 중이면 실시간 대화 열람(읽기 전용), 끝났으면 리포트 + 코멘트·점수 보정 입력란.
 * 언제: 대시보드에서 수강생 카드나 우수 사례를 눌렀을 때.
 * 리뷰 포인트: 강사 코멘트가 수강생 리포트에도 보인다는 점을 확인하세요(PRD R-04).
 * =====================
 */
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { loadReport } from "@/lib/report";
import { AppShell } from "@/components/AppShell";
import { Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ReportView } from "@/components/report/ReportView";
import { ReportWaiting } from "@/components/report/ReportWaiting";
import { LiveTranscript } from "@/components/instructor/LiveTranscript";
import { NoteForm } from "@/components/instructor/NoteForm";
import { PrintButton } from "@/components/PrintButton";

/** 강사용 대화 상세: 진행 중이면 실시간 열람(PRD A-13), 끝났으면 리포트 + 코멘트·보정(R-04) */
export default async function InstructorSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  const r = await loadReport(u, id).catch(() => null);
  if (!r) redirect("/instructor");

  return (
    <AppShell user={u} wide>
      <PageHeader
        title={`${r.learnerName} · ${r.content.title}`}
        description={`${new Date(r.session.started_at).toLocaleString("ko-KR")} · ${r.session.mode === "voice" ? "음성" : "텍스트"}`}
        actions={
          <div className="no-print flex gap-2">
            {r.evaluation && <PrintButton />}
            <LinkButton href={`/instructor/cohorts/${r.cohort.id}/learners/${r.session.user_id}`} variant="secondary">
              수강생 이력
            </LinkButton>
            <LinkButton href={`/instructor/cohorts/${r.cohort.id}`} variant="secondary">
              대시보드
            </LinkButton>
          </div>
        }
      />
      {r.session.status === "active" ? (
        <LiveTranscript
          sessionId={r.session.id}
          initial={r.messages.map((m) => ({ seq: m.seq, role: m.role, content: m.content, emotion: m.emotion }))}
          startedAt={r.session.started_at}
        />
      ) : r.evaluation ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <ReportView r={r} staffView />
          <Card className="no-print h-fit">
            <CardTitle>강사 코멘트·점수 보정</CardTitle>
            <NoteForm evaluationId={r.evaluation.id} currentScore={Number(r.evaluation.total_score)} />
          </Card>
        </div>
      ) : r.session.status === "failed" ? (
        <EmptyState title="평가를 만들지 못한 대화입니다.">대화가 너무 짧았거나 오류가 있었습니다.</EmptyState>
      ) : (
        <ReportWaiting sessionId={r.session.id} />
      )}
    </AppShell>
  );
}
