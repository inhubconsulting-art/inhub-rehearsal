/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 홈. 이어서 하기, 남은 이용권, 내 교육(+입장 코드), 최근 리포트, 이번 주 연습, 다음 연습 추천을 한눈에 보여 줍니다.
 * 언제: 로그인하면 처음 보는 화면 (수강생).
 * 리뷰 포인트: 숫자는 모두 실제 기록에서 계산합니다. '이번 주'는 최근 7일입니다.
 *         미리보기 기록은 빼고, 개인 연습(이용권)과 교육 과정 실습을 함께 보여 줍니다.
 * =====================
 */
import Link from "next/link";
import { COMPETENCY_LABELS, type EvaluationResult } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/format";
import { getPassBalance, isHiddenCohort, PRACTICE_CLIENT } from "@/lib/practice";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, LinkButton } from "@/components/ui";
import { JoinForm } from "@/components/learner/JoinForm";

type SessionJoin = {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  scenarios: { title: string } | null;
  cohorts: { title: string; client_name: string | null; status: string } | null;
  evaluations: { total_score: number; grade: string; result: EvaluationResult } | { total_score: number; grade: string; result: EvaluationResult }[] | null;
};

const COHORT_STATUS = { ready: ["실습 대기", "amber"], running: ["실습 중", "green"], paused: ["일시정지", "amber"], ended: ["종료", "slate"] } as const;

function CardHead({ title, href, label }: { title: string; href?: string; label?: string }) {
  return (
    <CardTitle
      right={
        href ? (
          <Link href={href} className="text-sm font-medium text-brand-600 hover:underline">
            {label ?? "전체 보기"} ›
          </Link>
        ) : undefined
      }
    >
      {title}
    </CardTitle>
  );
}

export default async function LearnerHome() {
  const u = await requirePageUser();
  const db = adminClient();
  const [balance, sessRes, enrRes] = await Promise.all([
    getPassBalance(u.id),
    db
      .from("sessions")
      .select("id, status, mode, started_at, ended_at, scenarios(title), cohorts(title, client_name, status), evaluations(total_score, grade, result)")
      .eq("user_id", u.id)
      .order("started_at", { ascending: false })
      .limit(60),
    db.from("enrollments").select("cohorts(id, title, course_name, client_name, status)").eq("user_id", u.id).order("joined_at", { ascending: false }),
  ]);
  const sessions = ((sessRes.data ?? []) as unknown as SessionJoin[]).filter((s) => s.cohorts?.client_name !== "__preview__");
  const ev = (s: SessionJoin) => (Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations) ?? null;
  const active = sessions.find((s) => s.status === "active");
  const evaluated = sessions.filter((s) => ev(s));
  const recent = evaluated.slice(0, 4);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const week = sessions.filter((s) => s.status !== "active" && new Date(s.started_at).getTime() >= weekAgo);
  const weekMin = Math.round(
    week.reduce((a, s) => a + (s.ended_at ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000 : 0), 0),
  );
  const weekScores = week.map((s) => ev(s)?.total_score).filter((x): x is number => x != null);
  const weekAvg = weekScores.length ? Math.round(weekScores.reduce((a, b) => a + Number(b), 0) / weekScores.length) : null;
  const latestRec = evaluated.map((s) => ev(s)?.result?.recommendation).find(Boolean);
  const cohorts = ((enrRes.data ?? []) as unknown as { cohorts: { id: string; title: string; course_name: string | null; client_name: string | null; status: keyof typeof COHORT_STATUS } | null }[])
    .map((r) => r.cohorts)
    .filter((c): c is NonNullable<typeof c> => !!c && !isHiddenCohort(c.client_name))
    .slice(0, 4);
  const isPractice = (s: SessionJoin) => s.cohorts?.client_name === PRACTICE_CLIENT;

  return (
    <AppShell user={u} wide>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">안녕하세요, {u.profile.name}님</h1>
        <p className="mt-1 text-sm text-slate-500">진행 중인 교육과 개인 연습을 한눈에 확인하세요.</p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          {active && (
            <Card>
              <CardHead title="이어서 하기" />
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {active.scenarios?.title ?? "진행 중인 실습"} · {active.mode === "voice" ? "음성" : "텍스트"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {isPractice(active) ? "개인 연습" : active.cohorts?.title} · {fmtDateTime(active.started_at)} 시작
                  </p>
                </div>
                <LinkButton href={`/learn/session/${active.id}`}>이어서 하기</LinkButton>
              </div>
            </Card>
          )}

          <Card>
            <CardHead title="최근 리포트" href="/learn/history" />
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">
                아직 리포트가 없어요.{" "}
                <Link href="/practice" className="text-brand-600 underline">
                  첫 연습을 시작해 보세요
                </Link>
                .
              </p>
            ) : (
              <ul>
                {recent.map((s) => {
                  const e = ev(s)!;
                  return (
                    <li key={s.id} className="border-t border-slate-100 first:border-0">
                      <Link href={`/learn/report/${s.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50">
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-extrabold ${
                            Number(e.total_score) >= 80 ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {e.grade}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{s.scenarios?.title}</span>
                          <span className="block text-xs text-slate-500">
                            {s.mode === "voice" ? "음성" : "텍스트"} · {isPractice(s) ? "개인 연습" : s.cohorts?.title} · {fmtDateTime(s.started_at)}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums">{Math.round(Number(e.total_score))}점</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHead title="이번 주 나의 연습" href="/learn/history" label="내 기록" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-500">연습 횟수</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{week.length}회</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">학습 시간</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{weekMin}분</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">평균 점수</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{weekAvg != null ? `${weekAvg}점` : "-"}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">최근 7일 기준</p>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Card>
            <CardHead title="남은 이용권" href="/pass" label="이용권" />
            <p>
              <span className="text-4xl font-extrabold tabular-nums">{balance ?? "-"}</span>
              <span className="ml-1 text-slate-500">회 남음</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">개인 연습 1번 = 1회 · 교육 과정 실습은 차감되지 않아요</p>
            <div className="mt-3">
              <LinkButton href="/practice" variant="secondary">
                연습하기
              </LinkButton>
            </div>
          </Card>

          <Card>
            <CardHead title="내 교육" href="/learn" />
            {cohorts.length > 0 && (
              <ul className="mb-4 space-y-2.5">
                {cohorts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/learn?cohort=${c.id}`} className="flex items-center gap-2 rounded-lg hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.title}</span>
                        {c.course_name && <span className="block truncate text-xs text-slate-500">{c.course_name}</span>}
                      </span>
                      <Badge tone={COHORT_STATUS[c.status]?.[1] ?? "slate"}>{COHORT_STATUS[c.status]?.[0] ?? c.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mb-2 text-xs text-slate-500">강사님께 받은 입장 코드로 새 교육에 참여해요.</p>
            <JoinForm />
          </Card>

          {latestRec && (
            <Card>
              <CardHead title="다음 연습 추천" />
              <p className="text-sm text-slate-600">
                최근 리포트에서 가장 보완이 필요한 역량은 <b className="text-slate-900">{COMPETENCY_LABELS[latestRec.competency]}</b>예요.
              </p>
              <p className="mt-1 text-sm text-slate-500">{latestRec.reason}</p>
              <div className="mt-3">
                <LinkButton href="/practice">연습하기에서 찾기</LinkButton>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
