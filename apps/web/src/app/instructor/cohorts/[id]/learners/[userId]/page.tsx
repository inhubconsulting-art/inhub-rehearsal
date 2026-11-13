/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 상세: 점수 추이, 역량별 평균(반 평균 대비 +/-), 모든 시도 목록(PRD A-23).
 * 언제: 대시보드에서 수강생 이름을 눌렀을 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { COMPETENCY_LABELS, END_REASON_LABELS, type EndReason } from "@inhub/shared";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { loadCohortDashboard } from "@/lib/cohort-data";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ScoreTrend } from "@/components/ScoreTrend";
import { fmtDateTime } from "@/lib/format";

/** 수강생 상세: 시도 이력, 점수 추이, 역량별 평균 (PRD A-23) */
export default async function LearnerDetail({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const d = await loadCohortDashboard(id);
  const learner = d.learners.find((l) => l.userId === userId);
  if (!learner) redirect(`/instructor/cohorts/${id}`);
  const sessions = d.sessions.filter((s) => s.userId === userId);
  const title = new Map(d.scenarios.map((s) => [s.id, s.title]));
  const trend = sessions
    .filter((s) => s.score != null)
    .reverse()
    .map((s, i) => ({ x: i + 1, score: Math.round(s.score!), label: title.get(s.scenarioId) ?? "" }));

  const comp = new Map<string, { sum: number; n: number }>();
  for (const s of sessions) {
    const r = d.results.get(s.id);
    if (!r) continue;
    for (const c of r.competencyScores) {
      const a = comp.get(c.competency) ?? { sum: 0, n: 0 };
      a.sum += c.score;
      a.n += 1;
      comp.set(c.competency, a);
    }
  }
  const classAvg = new Map(d.competencyAvg.map((c) => [c.competency, c.avg]));

  return (
    <AppShell user={u} wide>
      <PageHeader
        title={learner!.name}
        description={[learner!.organization, learner!.email].filter(Boolean).join(" · ")}
        actions={<LinkButton href={`/instructor/cohorts/${id}`} variant="secondary">대시보드</LinkButton>}
      />
      {sessions.length === 0 ? (
        <EmptyState title="아직 연습 기록이 없습니다." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardTitle>점수 추이</CardTitle>
              {trend.length >= 2 ? <ScoreTrend data={trend} /> : <p className="text-sm text-slate-500">평가가 2건 이상이면 표시됩니다.</p>}
            </Card>
            <Card>
              <CardTitle>역량별 평균 (반 평균 대비)</CardTitle>
              <ul className="space-y-2 text-sm">
                {[...comp.entries()].map(([k, v]) => {
                  const mine = Math.round(v.sum / v.n);
                  const cls = classAvg.get(k as keyof typeof COMPETENCY_LABELS);
                  const diff = cls != null ? mine - cls : null;
                  return (
                    <li key={k} className="flex items-center gap-3">
                      <span className="w-28">{COMPETENCY_LABELS[k as keyof typeof COMPETENCY_LABELS]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-brand-500" style={{ width: `${mine}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums">{mine}</span>
                      {diff != null && (
                        <span className={`w-12 text-right text-xs tabular-nums ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {diff >= 0 ? "+" : ""}
                          {diff}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">일시</th>
                  <th className="px-4 py-2 font-medium">시나리오</th>
                  <th className="px-4 py-2 font-medium">방식</th>
                  <th className="px-4 py-2 font-medium">종료</th>
                  <th className="px-4 py-2 font-medium">총평</th>
                  <th className="px-4 py-2 text-right font-medium">점수</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{fmtDateTime(s.startedAt)}</td>
                    <td className="px-4 py-2">
                      <Link href={`/instructor/sessions/${s.id}`} className="font-medium text-brand-600 hover:underline">
                        {title.get(s.scenarioId)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{s.mode === "voice" ? "음성" : "텍스트"}</td>
                    <td className="px-4 py-2">
                      {s.status === "active" ? <Badge tone="blue">진행 중</Badge> : END_REASON_LABELS[s.endReason as EndReason] ?? "-"}
                    </td>
                    <td className="max-w-md truncate px-4 py-2 text-slate-600">{s.summary ?? "-"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {s.score != null ? `${s.grade} · ${Math.round(s.score)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
