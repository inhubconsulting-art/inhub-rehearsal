/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트 일괄 인쇄 화면. 기본은 수강생·시나리오별 최고 점수 1건, 선택하면 모든 시도.
 * 언제: 내보내기 탭의 '리포트 일괄 인쇄'.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { redirect } from "next/navigation";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { loadCohortDashboard } from "@/lib/cohort-data";
import { loadReport } from "@/lib/report";
import { ReportView } from "@/components/report/ReportView";
import { PrintButton } from "@/components/PrintButton";

/** 리포트 일괄 인쇄 (브라우저 인쇄 → PDF로 저장). 수강생별 최고 점수 대화 1건씩 (PRD A-24) */
export default async function PrintAll({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { id } = await params;
  const { all } = await searchParams;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const d = await loadCohortDashboard(id);
  const evaluated = d.sessions.filter((s) => s.evaluationId);
  let picked = evaluated;
  if (!all) {
    const best = new Map<string, (typeof evaluated)[number]>();
    for (const s of evaluated) {
      const key = `${s.userId}:${s.scenarioId}`;
      const cur = best.get(key);
      if (!cur || (s.score ?? 0) > (cur.score ?? 0)) best.set(key, s);
    }
    picked = [...best.values()];
  }
  const names = new Map(d.learners.map((l) => [l.userId, l.name]));
  picked.sort((a, b) => (names.get(a.userId) ?? "").localeCompare(names.get(b.userId) ?? "", "ko"));
  const reports = await Promise.all(picked.map((s) => loadReport(u, s.id)));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-slate-100 p-4 text-sm">
        <span>
          {reports.length}건 · {all ? "모든 시도" : "수강생·시나리오별 최고 점수 1건"} ·{" "}
          <a className="text-brand-600 underline" href={all ? "?" : "?all=1"}>
            {all ? "최고 점수만 보기" : "모든 시도 보기"}
          </a>
        </span>
        <PrintButton label="인쇄 / PDF 저장" />
      </div>
      {reports.map((r) => (
        <div key={r.session.id} className="print-break mb-12">
          <h2 className="mb-3 text-xl font-bold">
            {r.learnerName} — {r.content.title}
          </h2>
          <ReportView r={r} staffView />
        </div>
      ))}
    </div>
  );
}
