/**
 * ===== 쉬운 설명 =====
 * 무엇: 최근 90일 사용량·비용 추정(교육 차수별). 비용 상한의 80%를 넘으면 주황, 넘으면 빨강으로 표시합니다(PRD
 *     A-31).
 * 언제: 관리자 메뉴 '사용량'.
 *     위쪽에는 OpenAI에서 직접 불러온 '실제 청구액'(이번 달·지난 달)과 앱 추정치를 나란히 보여 줍니다.
 * 리뷰 포인트: 차수별 금액은 앱 기록(토큰 수 × 단가표) 기반 추정이고, 실제 청구액은 기간 전체 합계만 있다는
 *         점이 화면에서 분명한지 확인하세요. 실제/추정 비율이 크게 벌어지면 cost.ts 단가표를 고칠 때입니다.
 * =====================
 */
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { estimateCost } from "@/lib/cost";
import { fetchActualCostsFor, type ActualCosts } from "@/lib/openai-costs";
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

  // ── 실제 청구액(OpenAI) vs 앱 추정: 이번 달·지난 달 (OpenAI가 UTC 날짜로 집계하므로 UTC 기준) ──
  const now = new Date();
  const thisStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const estimateBetween = (a: Date, b: Date) =>
    rows.reduce((sum, r) => {
      const t = new Date(r.started_at).getTime();
      return t >= a.getTime() && t < b.getTime() ? sum + estimateCost(r.usage ?? {}) : sum;
    }, 0);
  // 두 기간을 한 번의 조회로 가져옵니다 (OpenAI 조회 횟수 제한 때문)
  const [actualThis, actualLast] = await fetchActualCostsFor([
    { from: thisStart, to: tomorrow },
    { from: lastStart, to: thisStart },
  ]);
  const periods: { label: string; actual: ActualCosts; estimate: number }[] = [
    { label: `이번 달 (${thisStart.getUTCMonth() + 1}월)`, actual: actualThis, estimate: estimateBetween(thisStart, tomorrow) },
    { label: `지난 달 (${lastStart.getUTCMonth() + 1}월)`, actual: actualLast, estimate: estimateBetween(lastStart, thisStart) },
  ];

  return (
    <AppShell user={u} wide>
      <PageHeader title="사용량·비용" description="OpenAI 실제 청구액과, 앱이 기록한 사용량으로 계산한 교육 차수별 추정 비용입니다." />
      <ActualVsEstimate periods={periods} />
      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-700">교육 차수별 (최근 90일 · 앱 기록 기반 추정)</h2>
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

const usd = (v: number) => `$${v.toFixed(2)}`;

/** OpenAI 실제 청구액과 앱 추정치를 나란히 보여 주는 표 */
function ActualVsEstimate({ periods }: { periods: { label: string; actual: ActualCosts; estimate: number }[] }) {
  const first = periods[0].actual;
  if (!first.ok && first.reason === "no_key") {
    return (
      <Card className="mb-2 border-amber-200 bg-amber-50 text-sm text-amber-900">
        <p className="font-medium">OpenAI 실제 청구액을 보려면 관리자 키가 필요합니다.</p>
        <p className="mt-1">
          platform.openai.com → Settings → Organization → Admin keys 에서 키를 만든 뒤, Vercel 환경변수
          <code className="mx-1 rounded bg-white px-1">OPENAI_ADMIN_KEY</code>에 넣고 Redeploy 하세요.
        </p>
      </Card>
    );
  }
  const items = first.ok ? first.byLineItem.slice(0, 8) : [];
  return (
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">기간 (UTC)</th>
              <th className="px-4 py-2 text-right font-medium">OpenAI 실제 청구액</th>
              <th className="px-4 py-2 text-right font-medium">앱 추정</th>
              <th className="px-4 py-2 text-right font-medium">차이</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const diff = p.actual.ok && p.estimate > 0 ? (p.actual.total / p.estimate - 1) * 100 : null;
              return (
                <tr key={p.label} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{p.label}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {p.actual.ok ? (
                      usd(p.actual.total)
                    ) : p.actual.reason === "rate_limited" ? (
                      <span className="font-normal text-amber-600">1분 뒤 새로고침</span>
                    ) : (
                      <span className="font-normal text-rose-600">불러오기 실패</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{usd(p.estimate)}</td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      diff != null && Math.abs(diff) > 20 ? "font-semibold text-amber-600" : "text-slate-500"
                    }`}
                  >
                    {diff == null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          실제 청구액은 OpenAI가 하루 단위로 집계하며 반영까지 시간이 걸릴 수 있어요. 미리보기·테스트 사용과 앱 밖의 사용(예:
          Playground)도 포함됩니다. 차이가 ±20%를 넘으면 단가표를 점검하세요.
          {!first.ok && first.reason === "rate_limited"
            ? " (OpenAI 조회 횟수 한도에 잠시 걸렸어요. 1분 뒤 새로고침하면 보이고, 이후 10분 동안은 저장된 값을 씁니다.)"
            : !first.ok && first.message
              ? ` (오류: ${first.message})`
              : ""}
        </p>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-medium text-slate-700">이번 달 실제 비용 항목</p>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">아직 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((it) => (
              <li key={it.name} className="flex justify-between gap-3">
                <span className="truncate text-slate-600" title={it.name}>
                  {it.name}
                </span>
                <span className="tabular-nums">{usd(it.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
