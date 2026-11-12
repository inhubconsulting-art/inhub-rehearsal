/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 첫 화면. 참여한 교육 차수의 상태, 강사 공지, 시나리오 카드 목록(시도 횟수·최고 점수·잠김)을 보여줍니다. 참여한
 *     교육이 없으면 입장 코드 입력란을 보여줍니다.
 * 언제: 수강생이 로그인하면 바로.
 * 리뷰 포인트: 강사가 '실습 시작'을 누르기 전에는 대기 안내가, 시작 후에는 시나리오가 보이는지(PRD L-05) 확인하세요.
 * =====================
 */
import Link from "next/link";
import {
  DIFFICULTY_LABELS,
  INDUSTRY_LABELS,
  SCENARIO_TYPE_LABELS,
  type CohortRow,
} from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getCohortScenarios, loadScenarioContent } from "@/lib/domain";
import { getLearnerProgress } from "@/lib/progress";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CohortLive } from "@/components/learner/CohortLive";
import { JoinForm } from "@/components/learner/JoinForm";

const STATUS_LABEL = { ready: "실습 대기", running: "실습 중", paused: "일시정지", ended: "종료" } as const;
const STATUS_TONE = { ready: "amber", running: "green", paused: "amber", ended: "slate" } as const;

export default async function LearnHome({ searchParams }: { searchParams: Promise<{ cohort?: string; code?: string }> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const db = adminClient();
  const { data: enrollRows } = await db
    .from("enrollments")
    .select("cohort_id, joined_at, cohorts(*)")
    .eq("user_id", u.id)
    .order("joined_at", { ascending: false });
  const cohorts = ((enrollRows ?? []) as unknown as { cohorts: CohortRow }[])
    .map((r) => r.cohorts)
    .filter((c) => c && c.client_name !== "__preview__");

  const current =
    cohorts.find((c) => c.id === sp.cohort) ?? cohorts.find((c) => c.status !== "ended") ?? cohorts[0] ?? null;

  if (!current) {
    return (
      <AppShell user={u}>
        <PageHeader title="실습 참여" description="강사님이 알려준 입장 코드를 입력하세요." />
        <Card>
          <JoinForm initialCode={sp.code ?? ""} />
        </Card>
      </AppShell>
    );
  }

  const list = await getCohortScenarios(current.id);
  const progress = await getLearnerProgress(current.id, u.id, list, current.sequential);
  const contents = await Promise.all(list.map((cs) => loadScenarioContent(cs.scenario_id, cs.scenario_version)));
  const { data: activeSession } = await db
    .from("sessions")
    .select("id")
    .eq("user_id", u.id)
    .eq("cohort_id", current.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return (
    <AppShell user={u}>
      <CohortLive cohortId={current.id} userId={u.id} name={u.profile.name} activity="시나리오 목록" />
      <PageHeader
        title={current.title}
        description={[current.course_name, current.client_name].filter(Boolean).join(" · ")}
        actions={
          <>
            <Badge tone={STATUS_TONE[current.status]}>{STATUS_LABEL[current.status]}</Badge>
            <LinkButton href="/learn/history" variant="secondary">
              내 연습 기록
            </LinkButton>
          </>
        }
      />

      {current.announcement && (
        <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <span className="font-semibold">강사 공지 · </span>
          {current.announcement}
        </div>
      )}

      {activeSession && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>진행 중인 대화가 있습니다.</span>
          <LinkButton href={`/learn/session/${(activeSession as { id: string }).id}`}>이어서 하기</LinkButton>
        </div>
      )}

      {current.status === "ready" ? (
        <EmptyState title="강사님이 실습을 시작하면 시나리오가 열립니다.">이 화면을 켜 두면 자동으로 바뀝니다.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((cs, i) => {
            const c = contents[i];
            const p = progress.get(cs.scenario_id)!;
            const canPlay = current.status === "running" && !p.locked;
            return (
              <Card key={cs.scenario_id} className={p.locked ? "opacity-60" : ""}>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{INDUSTRY_LABELS[c.industry]}</Badge>
                  <Badge tone="violet">{SCENARIO_TYPE_LABELS[c.type]}</Badge>
                  <Badge>난이도 {DIFFICULTY_LABELS[c.difficulty]}</Badge>
                  {cs.required && <Badge tone="amber">필수</Badge>}
                </div>
                <h3 className="text-lg font-semibold">
                  {i + 1}. {c.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.briefing.summary}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    약 {Math.round(c.timeLimitSec / 60)}분 · 시도 {p.attempts}회
                    {p.bestScore != null && <> · 최고 {Math.round(p.bestScore)}점</>}
                  </span>
                  {p.locked ? (
                    <span className="text-xs text-slate-500">앞 시나리오 완료 후 열림</span>
                  ) : canPlay ? (
                    <LinkButton href={`/learn/${current.id}/scenarios/${cs.scenario_id}`}>
                      {p.attempts > 0 ? "다시 도전" : "시작하기"}
                    </LinkButton>
                  ) : p.lastSessionId ? (
                    <LinkButton href={`/learn/report/${p.lastSessionId}`} variant="secondary">
                      리포트 보기
                    </LinkButton>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <CardTitle>다른 교육 참여</CardTitle>
        <JoinForm />
        {cohorts.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {cohorts
              .filter((c) => c.id !== current.id)
              .map((c) => (
                <Link key={c.id} href={`/learn?cohort=${c.id}`} className="rounded-md border px-2 py-1 hover:bg-slate-50">
                  {c.title}
                </Link>
              ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
