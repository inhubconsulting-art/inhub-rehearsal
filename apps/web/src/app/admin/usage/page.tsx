/**
 * ===== 쉬운 설명 =====
 * 무엇: 최근 90일 사용량·비용 추정(교육 차수별). 비용 상한의 80%를 넘으면 주황, 넘으면 빨강으로 표시합니다(PRD
 *     A-31).
 * 언제: 관리자 메뉴 '사용량'.
 * 리뷰 포인트: 추정치라는 안내가 분명한지 확인하세요.
 * =====================
 */
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { estimateCost } from "@/lib/cost";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Stat } from "@/components/ui";

type Row = {
  cohort_id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  usage: Record<string, number>;
  cohorts: { title: string; client_name: string | null; budget_usd: number | null } | null;
};

/** API 사용량·비용 현황 (PRD A-31) */
export default async function Usage() {
  const u = await requirePageUser(["admin"]);
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data } = await adminClient()
    .from("sessions")
    .select("cohort_id, mode, started_at, ended_at, usage, cohorts(title, client_name, budget_usd)")
    .gte("started_at", since)
    .limit(10000);
  const rows = (data ?? []) as unknown as Row[];

  const byCohort = new Map<string, { title: string; client: string; budget: number | null; sessions: number; voiceMin: number; cost: number }>();
  let total = 0;
  let voiceMin = 0;
  for (const r of rows) {
    const cost = estimateCost(r.usage ?? {});
    const min = r.mode === "voice" && r.ended_at ? (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000 : 0;
    total += cost;
    voiceMin += min;
    const key = r.cohort_id;
    const cur = byCohort.get(key) ?? {
      title: r.cohorts?.title ?? "",
      client: r.cohorts?.client_name === "__preview__" ? "(미리보기)" : r.cohorts?.client_name ?? "",
      budget: r.cohorts?.budget_usd ?? null,
      sessions: 0,
      voiceMin: 0,
      cost: 0,
    };
    cur.sessions += 1;
    cur.voiceMin += min;
    cur.cost += cost;
    byCohort.set(key, cur);
  }
  const list = [...byCohort.entries()].sort((a, b) => b[1].cost - a[1].cost);

  return (
    <AppShell user={u} wide>
      <PageHeader title="사용량·비용" description="최근 90일 · 토큰 사용량 기반 추정치이며 실제 청구액은 OpenAI 대시보드에서 확인하세요." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="대화 수" value={rows.length} />
        <Stat label="음성 대화 시간" value={`${Math.round(voiceMin)}분`} />
        <Stat label="추정 비용" value={`$${total.toFixed(2)}`} />
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">교육 차수</th>
              <th className="px-4 py-2 font-medium">고객사</th>
              <th className="px-4 py-2 text-right font-medium">대화</th>
              <th className="px-4 py-2 text-right font-medium">음성(분)</th>
              <th className="px-4 py-2 text-right font-medium">추정 비용</th>
              <th className="px-4 py-2 text-right font-medium">상한</th>
            </tr>
          </thead>
          <tbody>
            {list.map(([id, c]) => {
              const over = c.budget != null && c.cost > c.budget;
              const near = c.budget != null && !over && c.cost > c.budget * 0.8;
              return (
                <tr key={id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/instructor/cohorts/${id}`} className="text-brand-600 hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.client || "-"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.sessions}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Math.round(c.voiceMin)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${over ? "font-semibold text-rose-600" : near ? "text-amber-600" : ""}`}>
                    ${c.cost.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{c.budget != null ? `$${c.budget}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
