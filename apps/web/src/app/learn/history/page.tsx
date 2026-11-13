/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 연습 기록' 대시보드 (PRD L-31).
 *  - 위: 전체 요약(연습 횟수·평균·최고·참여 교육 수)과 전체 점수 추이
 *  - 가운데: 교육 차수를 골라 그 차수의 점수 추이, 역량별 내 평균 vs 차수 평균, 시나리오별 최고·최근 점수
 *  - 아래: 그 차수의 연습 목록(누르면 리포트)
 * 리뷰 포인트: 점수는 강사가 보정했다면 보정 점수를 씁니다. 차수 평균은 같은 차수 수강생 전체의 익명 평균입니다.
 * =====================
 */
import Link from "next/link";
import { COMPETENCIES, COMPETENCY_LABELS, type Competency, type EvaluationResult } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ScoreTrend } from "@/components/ScoreTrend";
import { CompareRadar, ScenarioBars } from "@/components/report/HistoryCharts";

type Ev = { id: string; total_score: number; grade: string; result: EvaluationResult };
type Row = {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  cohort_id: string;
  scenario_id: string;
  scenarios: { title: string } | null;
  cohorts: { title: string; client_name: string | null; created_at: string } | null;
  evaluations: Ev | Ev[] | null;
};
type Item = Row & { ev: Ev | null; score: number | null };

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export default async function History({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const db = adminClient();
  const { data } = await db
    .from("sessions")
    .select(
      "id, status, mode, started_at, cohort_id, scenario_id, scenarios(title), cohorts(title, client_name, created_at), evaluations(id, total_score, grade, result)",
    )
    .eq("user_id", u.id)
    .order("started_at", { ascending: false })
    .limit(300);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.cohorts?.client_name !== "__preview__");

  // 강사 점수 보정 반영 (가장 최근 보정값)
  const evs = rows.map((r) => (Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations)).filter(Boolean) as Ev[];
  const overrides = new Map<string, number>();
  if (evs.length) {
    const { data: notes } = await db
      .from("instructor_notes")
      .select("evaluation_id, score_override, created_at")
      .in("evaluation_id", evs.map((e) => e.id))
      .not("score_override", "is", null)
      .order("created_at");
    for (const n of (notes ?? []) as { evaluation_id: string; score_override: number }[]) overrides.set(n.evaluation_id, Number(n.score_override));
  }
  const items: Item[] = rows.map((r) => {
    const ev = (Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations) ?? null;
    const score = ev ? Math.round(overrides.get(ev.id) ?? Number(ev.total_score)) : null;
    return { ...r, ev, score };
  });

  if (items.length === 0) {
    return (
      <AppShell user={u}>
        <PageHeader title="내 연습 기록" />
        <EmptyState title="아직 연습 기록이 없습니다.">실습 화면에서 시나리오를 골라 첫 연습을 시작해 보세요.</EmptyState>
      </AppShell>
    );
  }

  // ── 전체 요약 ──
  const scoredAll = items.filter((i) => i.score != null);
  const overallTrend = [...scoredAll].reverse().map((i, n) => ({ x: n + 1, score: i.score!, label: i.scenarios?.title ?? "" }));

  // ── 교육 차수 목록 (최근 연습 순) ──
  const cohortList: { id: string; title: string; count: number }[] = [];
  for (const i of items) {
    const c = cohortList.find((x) => x.id === i.cohort_id);
    if (c) c.count += 1;
    else cohortList.push({ id: i.cohort_id, title: i.cohorts?.title ?? "교육", count: 1 });
  }
  const selectedId = cohortList.some((c) => c.id === sp.cohort) ? sp.cohort! : cohortList[0].id;
  const sel = items.filter((i) => i.cohort_id === selectedId);
  const selScored = sel.filter((i) => i.score != null);

  // 차수 점수 추이
  const cohortTrend = [...selScored].reverse().map((i, n) => ({ x: n + 1, score: i.score!, label: i.scenarios?.title ?? "" }));

  // 역량별: 내 평균 vs 차수 평균(익명)
  const mineAcc = new Map<Competency, number[]>();
  for (const i of selScored) for (const c of i.ev!.result.competencyScores ?? []) mineAcc.set(c.competency, [...(mineAcc.get(c.competency) ?? []), c.score]);
  const { data: cohortEvs } = await db
    .from("evaluations")
    .select("result, sessions!inner(cohort_id)")
    .eq("sessions.cohort_id", selectedId)
    .limit(2000);
  const cohortAcc = new Map<Competency, number[]>();
  for (const e of (cohortEvs ?? []) as unknown as { result: EvaluationResult }[]) {
    for (const c of e.result?.competencyScores ?? []) cohortAcc.set(c.competency, [...(cohortAcc.get(c.competency) ?? []), c.score]);
  }
  const radar = COMPETENCIES.filter((c) => mineAcc.has(c)).map((c) => ({
    label: COMPETENCY_LABELS[c],
    mine: avg(mineAcc.get(c)!)!,
    cohort: avg(cohortAcc.get(c) ?? []),
  }));
  const strongest = [...radar].sort((a, b) => b.mine - a.mine)[0];
  const weakest = [...radar].sort((a, b) => a.mine - b.mine)[0];

  // 시나리오별 최고·최근
  const byScenario = new Map<string, { title: string; best: number | null; latest: number | null; tries: number }>();
  for (const i of sel) {
    const cur = byScenario.get(i.scenario_id) ?? { title: i.scenarios?.title ?? "", best: null, latest: null, tries: 0 };
    cur.tries += 1;
    if (i.score != null) {
      if (cur.latest == null) cur.latest = i.score; // 최근 순으로 정렬되어 있으므로 처음 만난 점수가 최근
      cur.best = Math.max(cur.best ?? 0, i.score);
    }
    byScenario.set(i.scenario_id, cur);
  }
  const scenarioData = [...byScenario.values()];

  return (
    <AppShell user={u}>
      <PageHeader title="내 연습 기록" description="연습할수록 어떤 역량이 좋아지는지 확인해 보세요." />

      {/* 전체 요약 */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="전체 연습" value={`${items.length}회`} />
        <Stat label="평균 점수" value={avg(scoredAll.map((i) => i.score!)) ?? "-"} />
        <Stat label="최고 점수" value={scoredAll.length ? Math.max(...scoredAll.map((i) => i.score!)) : "-"} />
        <Stat label="참여한 교육" value={`${cohortList.length}개`} />
      </div>
      {overallTrend.length >= 2 && (
        <Card className="mb-8">
          <CardTitle>전체 점수 추이</CardTitle>
          <ScoreTrend data={overallTrend} />
        </Card>
      )}

      {/* 차수 선택 */}
      <h2 className="mb-2 text-lg font-semibold">교육 차수별 분석</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {cohortList.map((c) => (
          <Link
            key={c.id}
            href={`/learn/history?cohort=${c.id}`}
            scroll={false}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              c.id === selectedId ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {c.title} <span className="text-xs text-slate-400">{c.count}</span>
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="이 차수 연습" value={`${sel.length}회`} />
        <Stat label="평균 점수" value={avg(selScored.map((i) => i.score!)) ?? "-"} />
        <Stat label="최고 점수" value={selScored.length ? Math.max(...selScored.map((i) => i.score!)) : "-"} />
        <Stat
          label="첫 연습 → 최근"
          value={
            selScored.length >= 2
              ? `${selScored[selScored.length - 1].score} → ${selScored[0].score}`
              : selScored.length === 1
                ? `${selScored[0].score}`
                : "-"
          }
          sub={
            selScored.length >= 2
              ? (() => {
                  const d = selScored[0].score! - selScored[selScored.length - 1].score!;
                  return d === 0 ? "변화 없음" : `${d > 0 ? "+" : ""}${d}점`;
                })()
              : undefined
          }
        />
      </div>

      {selScored.length === 0 ? (
        <EmptyState title="이 차수에는 아직 평가된 연습이 없습니다." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardTitle>역량별 평균 (나 vs 차수 평균)</CardTitle>
              <CompareRadar data={radar} />
              {strongest && weakest && strongest.label !== weakest.label && (
                <p className="mt-2 text-sm text-slate-600">
                  가장 강한 역량은 <span className="font-semibold text-brand-700">{strongest.label}</span>, 더 연습하면 좋은 역량은{" "}
                  <span className="font-semibold text-amber-700">{weakest.label}</span>입니다.
                </p>
              )}
            </Card>
            <Card>
              <CardTitle>이 차수 점수 추이</CardTitle>
              {cohortTrend.length >= 2 ? (
                <ScoreTrend data={cohortTrend} />
              ) : (
                <p className="text-sm text-slate-500">평가된 연습이 2회 이상이면 추이가 표시됩니다.</p>
              )}
            </Card>
          </div>
          <Card>
            <CardTitle>시나리오별 점수</CardTitle>
            <ScenarioBars data={scenarioData.map((s) => ({ title: s.title, best: s.best, latest: s.latest }))} />
            <p className="mt-1 text-xs text-slate-500">
              {scenarioData.map((s) => `${s.title} ${s.tries}회`).join(" · ")}
            </p>
          </Card>
        </div>
      )}

      {/* 연습 목록 */}
      <Card className="mt-5 overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">일시</th>
              <th className="px-4 py-2 font-medium">시나리오</th>
              <th className="px-4 py-2 font-medium">방식</th>
              <th className="px-4 py-2 text-right font-medium">점수</th>
            </tr>
          </thead>
          <tbody>
            {sel.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">{fmtDateTime(r.started_at)}</td>
                <td className="px-4 py-2">
                  <Link href={`/learn/report/${r.id}`} className="font-medium text-brand-600 hover:underline">
                    {r.scenarios?.title}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.mode === "voice" ? "음성" : "텍스트"}</td>
                <td className="px-4 py-2 text-right">
                  {r.ev ? (
                    <span className="tabular-nums">
                      {r.ev.grade} · {r.score}
                    </span>
                  ) : (
                    <Badge>{r.status === "active" ? "진행 중" : r.status === "failed" ? "평가 없음" : "평가 중"}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
