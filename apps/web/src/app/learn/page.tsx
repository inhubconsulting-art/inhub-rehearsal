/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 교육' 화면. 위쪽에서 참여한 교육 과정을 고르고, 과정 소개(구성·진행 방식·진행률·강사 공지) 아래에
 *     과정을 이루는 시나리오를 '1단계 → 2단계 …' 순서로 보여 줍니다(완료 / 지금 할 차례 / 잠김).
 *     참여한 교육이 없으면 입장 코드 입력란을 보여 줍니다. 새 교육 참여는 위쪽 '＋ 새 교육 참여'에서.
 * 언제: 왼쪽 메뉴 '내 교육', QR·공유 주소로 들어왔을 때.
 * 리뷰 포인트: 강사가 '실습 시작'을 누르기 전에는 대기 안내(시나리오 개수만), 시작 후에는 단계가 보이는지(PRD L-05) 확인하세요.
 *         '순서대로' 과정이면 잠긴 단계에 'n단계를 마치면 열려요'가 보입니다.
 * =====================
 */
import Link from "next/link";
import {
  careerLabel,
  DIFFICULTY_LABELS,
  INDUSTRY_LABELS,
  jobLabel,
  SCENARIO_TYPE_LABELS,
  type CohortRow,
} from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { getCohortScenarios, loadScenarioContent } from "@/lib/domain";
import { getLearnerProgress } from "@/lib/progress";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CohortLive } from "@/components/learner/CohortLive";
import { JoinForm } from "@/components/learner/JoinForm";

const STATUS_LABEL = { ready: "실습 대기", running: "실습 중", paused: "일시정지", ended: "종료" } as const;
const STATUS_TONE = { ready: "amber", running: "green", paused: "amber", ended: "slate" } as const;

export default async function LearnHome({ searchParams }: { searchParams: Promise<{ cohort?: string; code?: string; src?: string }> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  // 쉬운 설명: 입장 칸 위에 보여 줄 '내 정보' 한 줄 (입장할 때 이 정보가 함께 기록됨)
  const pr = u.profile;
  const profileSummary = pr.job_id
    ? [pr.organization, jobLabel(pr.job_id, pr.job_custom), `경력 ${careerLabel(pr.career)}`].filter(Boolean).join(" · ")
    : undefined;
  const db = adminClient();
  const { data: enrollRows } = await db
    .from("enrollments")
    .select("cohort_id, joined_at, cohorts(*)")
    .eq("user_id", u.id)
    .order("joined_at", { ascending: false });
  const cohorts = ((enrollRows ?? []) as unknown as { cohorts: CohortRow }[])
    .map((r) => r.cohorts)
    // 미리보기·개인 연습 전용 차수는 '내 교육'에서 빼고, 개인 연습은 '연습하기'에서 봄
    .filter((c) => c && c.client_name !== "__preview__" && c.client_name !== "__practice__");

  // 쉬운 설명: QR/링크로 들어와 주소에 입장 코드가 있는 경우
  //  - 이미 참여한 교육의 코드면 그 교육을 바로 보여 주고,
  //  - 처음 보는 코드면 화면 맨 위에 '입장 코드가 채워진 참여 칸'을 띄웁니다.
  const code = (sp.code ?? "").trim().toUpperCase();
  let codeCohortId: string | null = null;
  if (code) {
    const { data: byCode } = await db.from("cohorts").select("id").eq("join_code", code).maybeSingle();
    codeCohortId = (byCode as { id: string } | null)?.id ?? null;
  }
  const joinedByCode = codeCohortId ? cohorts.find((c) => c.id === codeCohortId) : undefined;
  const pendingCode = code && !joinedByCode ? code : "";
  // 쉬운 설명: QR(src=qr)·공유 주소(src=link)로 들어왔는지. 코드를 직접 입력하면 'code'로 기록됩니다.
  const entrySource = sp.src === "qr" || sp.src === "link" ? sp.src : undefined;

  const current =
    joinedByCode ??
    cohorts.find((c) => c.id === sp.cohort) ??
    cohorts.find((c) => c.status !== "ended") ??
    cohorts[0] ??
    null;

  if (!current) {
    return (
      <AppShell user={u}>
        <PageHeader title="실습 참여" description="강사님이 알려준 입장 코드를 입력하세요." />
        <Card>
          <JoinForm initialCode={sp.code ?? ""} entrySource={sp.code ? entrySource : undefined} profileSummary={profileSummary} />
        </Card>
      </AppShell>
    );
  }

  const list = [...(await getCohortScenarios(current.id))].sort((a, b) => a.position - b.position);
  const progress = await getLearnerProgress(current.id, u.id, list, current.sequential);
  const contents = await Promise.all(list.map((cs) => loadScenarioContent(cs.scenario_id, cs.scenario_version)));
  const [{ data: activeSession }, { data: instructor }] = await Promise.all([
    db.from("sessions").select("id").eq("user_id", u.id).eq("cohort_id", current.id).eq("status", "active").limit(1).maybeSingle(),
    current.instructor_id
      ? db.from("profiles").select("name").eq("id", current.instructor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 쉬운 설명: 단계별 상태 계산 — 완료(한 번 이상 끝냄) / 지금 할 차례 / 열림 / 잠김
  const required = list.filter((cs) => cs.required);
  const doneCount = (arr: typeof list) => arr.filter((cs) => (progress.get(cs.scenario_id)?.completed ?? 0) > 0).length;
  const requiredDone = doneCount(required);
  const allDone = doneCount(list);
  const nextStep = list.find((cs) => {
    const p = progress.get(cs.scenario_id)!;
    return !p.locked && p.completed === 0;
  });
  const pct = required.length ? Math.round((requiredDone / required.length) * 100) : 0;
  // 잠긴 단계를 막고 있는 앞쪽 필수 단계 번호 (1부터)
  const blockerOf = (i: number) => {
    const j = list.findIndex((cs, k) => k < i && cs.required && (progress.get(cs.scenario_id)?.completed ?? 0) === 0);
    return j >= 0 ? j + 1 : i;
  };
  const minutesOf = (i: number) => Math.round((current.time_limit_sec ?? contents[i].timeLimitSec) / 60);
  const modes = current.allowed_modes.map((m) => (m === "voice" ? "음성" : "텍스트")).join("·");
  const others = cohorts.filter((c) => c.id !== current.id);

  return (
    <AppShell user={u}>
      <CohortLive cohortId={current.id} userId={u.id} name={u.profile.name} activity="시나리오 목록" />
      {pendingCode && (
        <Card className="mb-6 border-brand-200 bg-brand-50/60">
          <CardTitle>새 교육에 입장하기</CardTitle>
          <p className="mb-3 text-sm text-slate-600">QR로 받은 입장 코드가 입력되어 있어요. 동의에 체크하고 참여하기를 눌러 주세요.</p>
          <JoinForm initialCode={pendingCode} entrySource={entrySource} profileSummary={profileSummary} />
        </Card>
      )}

      {/* ① 내가 참여한 교육 과정 고르기 + 새 교육 참여 */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-slate-500">내 교육</span>
        {cohorts.map((c) => {
          const on = c.id === current.id;
          return (
            <Link
              key={c.id}
              href={`/learn?cohort=${c.id}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm ${
                on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${c.status === "running" ? "bg-emerald-400" : c.status === "ended" ? "bg-slate-300" : "bg-amber-400"}`} aria-hidden="true" />
              {c.title}
            </Link>
          );
        })}
        <details className="group relative ml-auto">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-full border border-dashed border-slate-300 px-3.5 text-sm text-slate-600 hover:bg-slate-50">
            ＋ 새 교육 참여
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-[min(92vw,420px)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="mb-2 text-sm font-semibold">입장 코드로 새 교육 참여</p>
            <JoinForm profileSummary={profileSummary} />
          </div>
        </details>
      </div>

      {/* ② 교육 과정 소개 */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-600">교육 과정{current.client_name ? ` · ${current.client_name}` : ""}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{current.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[
                current.course_name,
                (instructor as { name?: string } | null)?.name ? `강사 ${(instructor as { name: string }).name}` : null,
                current.starts_at ? `${fmtDate(current.starts_at)} 시작` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[current.status]}>{STATUS_LABEL[current.status]}</Badge>
            <LinkButton href="/learn/history" variant="secondary">
              내 연습 기록
            </LinkButton>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">구성</dt>
            <dd className="mt-0.5 font-semibold">
              시나리오 {list.length}개{required.length !== list.length && ` (필수 ${required.length})`}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">진행 방식</dt>
            <dd className="mt-0.5 font-semibold">{current.sequential ? "순서대로 (단계별 열림)" : "원하는 순서로"}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">대화 방식</dt>
            <dd className="mt-0.5 font-semibold">{modes}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">한 시나리오</dt>
            <dd className="mt-0.5 font-semibold">{current.time_limit_sec ? `${Math.round(current.time_limit_sec / 60)}분 이내` : "시나리오별 시간"}</dd>
          </div>
        </dl>

        {current.status !== "ready" && list.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {required.length ? `필수 ${required.length}개 중 ${requiredDone}개 완료` : `${list.length}개 중 ${allDone}개 완료`}
              </span>
              <span className="tabular-nums text-slate-500">{required.length ? pct : Math.round((allDone / list.length) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${required.length ? pct : Math.round((allDone / list.length) * 100)}%` }} />
            </div>
            {required.length > 0 && requiredDone === required.length && (
              <p className="mt-2 text-sm font-medium text-emerald-700">필수 과정을 모두 마쳤어요. 원하는 시나리오로 더 연습해 보세요.</p>
            )}
          </div>
        )}

        {current.announcement && (
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <span className="font-semibold">강사 공지 · </span>
            {current.announcement}
          </div>
        )}
      </section>

      {activeSession && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>진행 중인 대화가 있습니다.</span>
          <LinkButton href={`/learn/session/${(activeSession as { id: string }).id}`}>이어서 하기</LinkButton>
        </div>
      )}
      {current.status === "paused" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">강사님이 실습을 잠시 멈췄습니다.</span> 다시 시작되면 이 화면에서 자동으로 열립니다.
        </div>
      )}
      {current.status === "ended" && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          이 교육의 실습은 종료되었습니다. 지난 리포트는 계속 볼 수 있어요.
        </div>
      )}

      {/* ③ 단계별 진행 */}
      {current.status === "ready" ? (
        <EmptyState title={`이 과정은 시나리오 ${list.length}개로 구성돼요.`}>강사님이 실습을 시작하면 단계가 열립니다. 이 화면을 켜 두면 자동으로 바뀝니다.</EmptyState>
      ) : (
        <section aria-labelledby="steps-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="steps-title" className="text-lg font-bold">
              교육 과정 단계 <span className="text-sm font-normal text-slate-500">· 전체 {list.length}단계</span>
            </h2>
            {current.sequential && (
              <p className="text-sm text-slate-500">🔒 앞 단계(필수)를 한 번 마치면 다음 단계가 열려요.</p>
            )}
          </div>
          <ol className="relative">
            {list.map((cs, i) => {
              const c = contents[i];
              const p = progress.get(cs.scenario_id)!;
              const done = p.completed > 0;
              const isNext = nextStep?.scenario_id === cs.scenario_id;
              const canPlay = current.status === "running" && !p.locked;
              const last = i === list.length - 1;
              return (
                <li key={cs.scenario_id} className="relative flex gap-4 pb-4">
                  {/* 단계 번호와 잇는 선 */}
                  <div className="flex flex-col items-center">
                    <span
                      className={`z-[1] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done
                          ? "bg-emerald-500 text-white"
                          : isNext
                            ? "bg-brand-500 text-white ring-4 ring-brand-100"
                            : p.locked
                              ? "bg-slate-100 text-slate-400"
                              : "border-2 border-slate-300 bg-white text-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {done ? "✓" : p.locked ? "🔒" : i + 1}
                    </span>
                    {!last && <span className={`mt-1 w-0.5 flex-1 ${done ? "bg-emerald-300" : "bg-slate-200"}`} aria-hidden="true" />}
                  </div>
                  <div
                    className={`min-w-0 flex-1 rounded-xl border bg-white p-4 ${
                      isNext ? "border-brand-300 shadow-sm" : "border-slate-200"
                    } ${p.locked ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-semibold text-slate-500">{i + 1}단계</span>
                      {done && <Badge tone="green">완료</Badge>}
                      {isNext && !done && <Badge tone="blue">지금 할 차례</Badge>}
                      {p.locked && <Badge>잠김</Badge>}
                      {cs.required ? <Badge tone="amber">필수</Badge> : <Badge>선택</Badge>}
                      <span className="mx-1 h-3 w-px bg-slate-200" aria-hidden="true" />
                      <Badge tone="blue">{INDUSTRY_LABELS[c.industry]}</Badge>
                      <Badge tone="violet">{SCENARIO_TYPE_LABELS[c.type]}</Badge>
                      <Badge>난이도 {DIFFICULTY_LABELS[c.difficulty]}</Badge>
                    </div>
                    <h3 className="mt-2 text-base font-bold">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.briefing.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">
                        약 {minutesOf(i)}분 · 시도 {p.attempts}회{p.bestScore != null && <> · 최고 {Math.round(p.bestScore)}점</>}
                      </span>
                      <span className="flex gap-2">
                        {p.lastSessionId && p.completed > 0 && (
                          <LinkButton href={`/learn/report/${p.lastSessionId}`} variant="secondary">
                            리포트
                          </LinkButton>
                        )}
                        {p.locked ? (
                          <span className="text-xs text-slate-500">{blockerOf(i)}단계를 마치면 열려요</span>
                        ) : canPlay ? (
                          <LinkButton href={`/learn/${current.id}/scenarios/${cs.scenario_id}`} variant={done ? "secondary" : "primary"}>
                            {p.attempts > 0 ? "다시 도전" : "시작하기"}
                          </LinkButton>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {others.length === 0 && cohorts.length === 1 && (
        <p className="mt-6 text-center text-xs text-slate-400">다른 교육에 참여하려면 위쪽 &lsquo;＋ 새 교육 참여&rsquo;를 누르세요.</p>
      )}
    </AppShell>
  );
}
