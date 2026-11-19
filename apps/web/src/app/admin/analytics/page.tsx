/**
 * ===== 쉬운 설명 =====
 * 무엇: 관리자용 '차수 비교' 화면. 최근 교육 차수들의 참여율·필수 완료율·평균 점수·응대 습관을 한 표에서 비교하고,
 *      차수 이름을 누르면 그 차수의 심화 분석으로 갑니다.
 * 언제: 관리자 메뉴 '분석'.
 * 리뷰 포인트: 최근 차수 30개만 계산합니다(화면 속도). 가입 퍼널·유입 경로·비용 같은 운영 숫자는 Looker Studio 보고서에서 봅니다.
 * =====================
 */
import Link from "next/link";
import type { CohortRow } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { summarizeCohorts } from "@/lib/cohort-analytics";
import { fmtDate } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const STATUS: Record<CohortRow["status"], { label: string; tone: "slate" | "green" | "amber" | "blue" }> = {
  ready: { label: "대기", tone: "slate" },
  running: { label: "실습 중", tone: "green" },
  paused: { label: "일시정지", tone: "amber" },
  ended: { label: "종료", tone: "blue" },
};
const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);
const num = (x: number | null, unit = "") => (x == null ? "-" : `${x}${unit}`);

export default async function AdminAnalytics() {
  const u = await requirePageUser(["admin"]);
  const { data } = await adminClient()
    .from("cohorts")
    .select("*")
    .or("client_name.is.null,client_name.not.in.(__preview__,__practice__)")
    .order("created_at", { ascending: false })
    .limit(30);
  const cohorts = (data ?? []) as CohortRow[];
  const sums = await summarizeCohorts(cohorts.map((c) => c.id));

  return (
    <AppShell user={u} wide>
      <PageHeader
        title="분석 · 차수 비교"
        description="최근 교육 차수 30개를 비교해요. 차수 이름을 누르면 심화 분석으로 갑니다. 가입·유입·비용 같은 운영 숫자는 Looker Studio 보고서에서 보세요."
      />
      {cohorts.length === 0 ? (
        <EmptyState title="아직 교육 차수가 없어요." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">교육 차수</th>
                  <th className="px-3 py-2.5 font-medium">시작일</th>
                  <th className="px-3 py-2.5 text-right font-medium">수강생</th>
                  <th className="px-3 py-2.5 text-right font-medium">실습 참여</th>
                  <th className="px-3 py-2.5 text-right font-medium">필수 완료</th>
                  <th className="px-3 py-2.5 text-right font-medium">평균 점수</th>
                  <th className="px-3 py-2.5 text-right font-medium">1인 학습</th>
                  <th className="px-3 py-2.5 text-right font-medium">쿠션어</th>
                  <th className="px-3 py-2.5 text-right font-medium">공감</th>
                  <th className="px-3 py-2.5 text-right font-medium">말버릇</th>
                  <th className="px-5 py-2.5 text-right font-medium">금지 표현</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => {
                  const s = sums.get(c.id)!;
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5">
                        <Link href={`/instructor/cohorts/${c.id}/analytics`} className="font-medium text-brand-600 hover:underline">
                          {c.title}
                        </Link>{" "}
                        <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                        <div className="text-xs text-slate-500">{[c.client_name, c.course_name].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtDate(c.starts_at ?? c.created_at)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.enrolled}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{pct(s.participationRate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{pct(s.requiredDoneRate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.avgScore)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.avgMinutesPerLearner, "분")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.habits.cushion_rate, "%")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.habits.empathy_rate, "%")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.habits.filler_rate, "%")}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{num(s.habits.forbidden_rate, "%")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
