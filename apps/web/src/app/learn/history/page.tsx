/**
 * ===== 쉬운 설명 =====
 * 무엇: 내 연습 기록. 지금까지의 모든 대화와 점수, 점수 추이 그래프(PRD L-31).
 * 언제: 수강생이 '내 연습 기록'을 누를 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ScoreTrend } from "@/components/ScoreTrend";
import { fmtDateTime } from "@/lib/format";

type Row = {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  scenario_id: string;
  scenarios: { title: string } | null;
  cohorts: { title: string; client_name: string | null } | null;
  evaluations: { total_score: number; grade: string } | { total_score: number; grade: string }[] | null;
};

/** 내 연습 기록: 시나리오별 시도·점수 추이 (PRD L-31) */
export default async function History() {
  const u = await requirePageUser();
  const { data } = await adminClient()
    .from("sessions")
    .select("id, status, mode, started_at, scenario_id, scenarios(title), cohorts(title, client_name), evaluations(total_score, grade)")
    .eq("user_id", u.id)
    .order("started_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.cohorts?.client_name !== "__preview__");
  const ev = (r: Row) => (Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations);
  const trend = rows
    .filter((r) => ev(r))
    .reverse()
    .map((r, i) => ({ x: i + 1, score: Math.round(Number(ev(r)!.total_score)), label: r.scenarios?.title ?? "" }));

  return (
    <AppShell user={u}>
      <PageHeader title="내 연습 기록" />
      {rows.length === 0 ? (
        <EmptyState title="아직 연습 기록이 없습니다." />
      ) : (
        <>
          {trend.length >= 2 && (
            <Card className="mb-5">
              <h2 className="mb-2 font-semibold">점수 추이</h2>
              <ScoreTrend data={trend} />
            </Card>
          )}
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">일시</th>
                  <th className="px-4 py-2 font-medium">시나리오</th>
                  <th className="px-4 py-2 font-medium">교육</th>
                  <th className="px-4 py-2 font-medium">방식</th>
                  <th className="px-4 py-2 text-right font-medium">점수</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = ev(r);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{fmtDateTime(r.started_at)}</td>
                      <td className="px-4 py-2">
                        <Link href={`/learn/report/${r.id}`} className="font-medium text-brand-600 hover:underline">
                          {r.scenarios?.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{r.cohorts?.title}</td>
                      <td className="px-4 py-2">{r.mode === "voice" ? "음성" : "텍스트"}</td>
                      <td className="px-4 py-2 text-right">
                        {e ? (
                          <span className="tabular-nums">
                            {e.grade} · {Math.round(Number(e.total_score))}
                          </span>
                        ) : (
                          <Badge>{r.status === "active" ? "진행 중" : r.status === "failed" ? "평가 없음" : "평가 중"}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
