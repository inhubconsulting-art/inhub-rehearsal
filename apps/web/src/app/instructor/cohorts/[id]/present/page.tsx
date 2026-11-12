/**
 * ===== 쉬운 설명 =====
 * 무엇: 디브리핑 발표 화면. 큰 글씨, 실명 없이 반 요약과 우수 응대 사례를 보여줍니다(PRD A-22).
 * 언제: 실습 후 강사가 화면을 공유할 때.
 * 리뷰 포인트: 빔프로젝터에 띄웠을 때 글씨 크기와 구성이 적절한지 확인하세요.
 * =====================
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { COMPETENCY_LABELS } from "@inhub/shared";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { loadCohortDashboard } from "@/lib/cohort-data";
import { adminClient } from "@/lib/supabase/admin";
import { SummaryBody } from "@/components/instructor/CohortDashboard";

/** 디브리핑 발표 화면: 큰 글씨, 실명 가림 (PRD A-22) */
export default async function Present({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const d = await loadCohortDashboard(id);
  const top = d.sessions
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 2);

  // 우수 사례: 잘한 점으로 인용된 발화 원문
  const examples: { scenario: string; quote: string; reason: string }[] = [];
  for (const s of top) {
    const r = d.results.get(s.id);
    if (!r) continue;
    const { data } = await adminClient().from("messages").select("seq, content").eq("session_id", s.id);
    const bySeq = new Map(((data ?? []) as { seq: number; content: string }[]).map((m) => [m.seq, m.content]));
    for (const g of r.goodPoints.slice(0, 2)) {
      examples.push({
        scenario: d.scenarios.find((x) => x.id === s.scenarioId)?.title ?? "",
        quote: bySeq.get(g.messageSeq) ?? g.quote,
        reason: g.reason,
      });
    }
  }
  const weakest = [...d.competencyAvg].sort((a, b) => a.avg - b.avg)[0];

  return (
    <div className="min-h-screen bg-white px-12 py-10">
      <div className="no-print mb-8 flex justify-between text-sm">
        <Link href={`/instructor/cohorts/${id}`} className="text-slate-500 hover:underline">
          ← 대시보드
        </Link>
        <span className="text-slate-400">F11 로 전체 화면</span>
      </div>
      <h1 className="text-4xl font-black">{d.cohort.title} 실습 디브리핑</h1>
      <p className="mt-2 text-xl text-slate-500">
        참여 {d.learners.length}명 · 대화 {d.sessions.filter((s) => s.status !== "active").length}건
        {weakest && ` · 가장 보완이 필요한 역량: ${COMPETENCY_LABELS[weakest.competency]}`}
      </p>

      <section className="mt-12">
        {d.summary?.content ? (
          <SummaryBody s={d.summary.content} large />
        ) : (
          <p className="text-2xl text-slate-400">대시보드의 ‘AI 요약 만들기’를 먼저 눌러 주세요.</p>
        )}
      </section>

      {examples.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-3xl font-bold">우수 응대 사례</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {examples.map((e, i) => (
              <div key={i} className="rounded-2xl bg-brand-50 p-8">
                <div className="text-base text-brand-700">{e.scenario}</div>
                <p className="mt-3 text-2xl font-semibold leading-snug">&ldquo;{e.quote}&rdquo;</p>
                <p className="mt-4 text-lg text-slate-600">{e.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
