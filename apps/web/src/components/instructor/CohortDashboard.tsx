"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 대시보드 본체. 위쪽: 입장 코드/QR, 실습 시작·정지·종료, 공지, 요약 숫자. 아래 탭: 실시간(수강생 카드·도움
 *     필요), 분석·디브리핑(AI 요약, 역량 평균, 점수 분포, 우수 사례), 수강생(점수표), 내보내기.
 * 언제: 교육 당일 강사가 계속 띄워 두는 화면.
 * 리뷰 포인트: 가장 중요한 강사 화면입니다. 맨 위 flagsFor 의 '도움 필요' 기준(2분 무응답, 고객 감정 최고치, 연속 60점
 *         미만, 연결 오류)이 현장 감각과 맞는지 꼭 확인하세요(PRD A-12).
 * =====================
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { emotionLabel, type CohortRow, type CohortSummary, type Competency } from "@inhub/shared";
import type { DashLearner, DashScenario, DashSession } from "@/lib/cohort-data";
import { Badge, Button, Card, CardTitle, EmptyState, ErrorText, Input, LinkButton, Stat } from "@/components/ui";
import { useCohortRealtime } from "./useCohortRealtime";
import { fmtDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";

const STATUS = {
  ready: { label: "준비", tone: "amber" },
  running: { label: "실습 중", tone: "green" },
  paused: { label: "일시정지", tone: "amber" },
  ended: { label: "종료", tone: "slate" },
} as const;

type Tab = "live" | "analysis" | "learners" | "export";

/** 도움이 필요한 수강생 판단 (PRD A-12) */
function flagsFor(learnerSessions: DashSession[], now: number): string[] {
  const flags: string[] = [];
  const active = learnerSessions.find((s) => s.status === "active");
  if (active) {
    const idle = (now - new Date(active.lastActivityAt).getTime()) / 1000;
    // 쉬운 설명: 기준 1: 대화 중인데 2분(120초) 넘게 새 발화가 없음
    if (idle > 120) flags.push(`${Math.floor(idle / 60)}분째 응답 없음`);
    // 쉬운 설명: 기준 2: 고객 감정이 '매우 화남'(4)
    if ((active.currentEmotion ?? 0) >= 4) flags.push("고객 감정 최고치");
  }
  const scored = learnerSessions.filter((s) => s.score != null).slice(0, 2);
  // 쉬운 설명: 기준 3: 최근 두 번 연속 60점 미만
  if (scored.length === 2 && scored.every((s) => (s.score ?? 100) < 60)) flags.push("연속 저점수");
  // 쉬운 설명: 기준 4: 최근 대화가 오류로 끝남
  if (learnerSessions[0]?.endReason === "error") flags.push("연결 오류");
  return flags;
}

export function CohortDashboard(props: {
  cohort: CohortRow;
  learners: DashLearner[];
  sessions: DashSession[];
  scenarios: DashScenario[];
  competencyAvg: { competency: Competency; label: string; avg: number; n: number }[];
  summary: { status: string; content: CohortSummary | null; evaluationCount: number; updatedAt: string } | null;
  joinUrl: string;
  qrDataUrl: string;
}) {
  const { cohort, learners, sessions, scenarios } = props;
  const router = useRouter();
  const { online } = useCohortRealtime(cohort.id);
  const [tab, setTab] = useState<Tab>("live");
  const [now, setNow] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);
  const [announcement, setAnnouncement] = useState(cohort.announcement ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const byLearner = useMemo(() => {
    const m = new Map<string, DashSession[]>();
    for (const s of sessions) m.set(s.userId, [...(m.get(s.userId) ?? []), s]);
    return m;
  }, [sessions]);
  const scenarioTitle = useMemo(() => new Map(scenarios.map((s) => [s.id, s.title])), [scenarios]);
  const required = scenarios.filter((s) => s.required);

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const scored = sessions.filter((s) => s.score != null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length) : null;
  const pending = sessions.filter((s) => s.status === "ended" || s.status === "evaluating").length;

  /** 차수 상태·공지·보관을 바꿉니다. 성공하면 successMsg 알림을 띄웁니다. */
  async function patch(body: Record<string, unknown>, successMsg?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cohorts/${cohort.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? "저장하지 못했습니다.";
      setError(msg);
      showToast(msg, "error");
      return false;
    }
    if (successMsg) showToast(successMsg);
    router.refresh();
    return true;
  }

  // 쉬운 설명: 복제하면 새 차수가 만들어지고, 바로 그 차수의 '설정' 화면으로 이동합니다.
  async function duplicate() {
    if (!confirm("이 차수의 설정과 시나리오 구성을 복사해 새 차수를 만들까요? (수강생·대화 기록은 복사되지 않습니다)")) return;
    setBusy(true);
    const res = await fetch(`/api/cohorts/${cohort.id}/duplicate`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return showToast(json.error ?? "복제하지 못했습니다.", "error");
    router.push(`/instructor/cohorts/${json.cohortId}/settings`);
  }

  async function requestSummary() {
    setBusy(true);
    const res = await fetch(`/api/cohorts/${cohort.id}/summary`, { method: "POST" });
    setBusy(false);
    if (!res.ok) setError((await res.json()).error);
    router.refresh();
  }

  return (
    <div>
      {toast}
      {cohort.archived_at && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <span>보관된 차수입니다. 강사 첫 화면의 &lsquo;보관됨&rsquo; 탭에서만 보입니다.</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void patch({ archived: false }, "보관을 해제했습니다")}>
            보관 해제
          </Button>
        </div>
      )}
      {/* 헤더 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{cohort.title}</h1>
            <Badge tone={STATUS[cohort.status].tone}>{STATUS[cohort.status].label}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {[cohort.client_name, cohort.course_name].filter(Boolean).join(" · ")} · 수강생 {learners.length}명 · 시나리오{" "}
            {scenarios.length}개
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
            <Link
              href={`/instructor/cohorts/${cohort.id}/settings`}
              className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ⚙ 설정
            </Link>
            <Button size="sm" variant="ghost" onClick={duplicate} disabled={busy}>
              ⧉ 복제
            </Button>
            {cohort.status === "ended" && !cohort.archived_at && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (confirm("이 차수를 보관할까요? 목록의 '보관됨' 탭으로 옮겨지며, 언제든 보관 해제할 수 있습니다.")) {
                    void patch({ archived: true }, "보관했습니다");
                  }
                }}
              >
                🗄 보관
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowQr((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left hover:bg-slate-50"
            title="눌러서 QR 보기"
          >
            <div className="text-[10px] text-slate-500">입장 코드 · {showQr ? "QR 닫기" : "QR 보기"}</div>
            <div className="font-mono text-lg font-bold tracking-widest">{cohort.join_code}</div>
          </button>
          {cohort.status === "ready" && (
            <Button onClick={() => patch({ status: "running" }, "실습을 시작했습니다")} disabled={busy}>
              실습 시작
            </Button>
          )}
          {cohort.status === "running" && (
            <Button variant="secondary" onClick={() => patch({ status: "paused" }, "일시정지했습니다")} disabled={busy}>
              일시정지
            </Button>
          )}
          {cohort.status === "paused" && (
            <Button onClick={() => patch({ status: "running" }, "실습을 재개했습니다")} disabled={busy}>
              재개
            </Button>
          )}
          {cohort.status !== "ended" && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (confirm("실습을 종료할까요? 진행 중인 대화는 모두 종료되고 평가가 만들어집니다.")) void patch({ status: "ended" }, "실습을 종료했습니다");
              }}
            >
              실습 종료
            </Button>
          )}
          {cohort.status === "ended" && (
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm("종료한 실습을 다시 열까요? 수강생이 다시 대화를 시작할 수 있게 됩니다.")) {
                  void patch({ status: "running" }, "실습을 다시 열었습니다");
                }
              }}
              disabled={busy}
            >
              다시 열기
            </Button>
          )}
        </div>
      </div>

      {showQr && (
        <Card className="mb-5 flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.qrDataUrl} alt="입장 QR" className="h-48 w-48" />
          <div>
            <p className="text-sm text-slate-500">수강생 입장 방법</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>휴대폰 카메라로 QR을 찍거나 아래 주소로 접속</li>
              <li>회원가입 또는 로그인</li>
              <li>
                입장 코드 <span className="font-mono font-bold">{cohort.join_code}</span> 입력
              </li>
            </ol>
            <p className="mt-3 break-all font-mono text-xs text-slate-500">{props.joinUrl}</p>
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!announcement.trim()) return;
            void patch({ announcement }, "공지를 보냈습니다. 수강생 화면 상단에 표시됩니다");
          }}
        >
          <Input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="수강생 화면에 띄울 공지 (예: 10분 뒤 실습을 마칩니다)" />
          <Button type="submit" variant="secondary" disabled={busy || !announcement.trim()}>
            공지 보내기
          </Button>
          {cohort.announcement && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAnnouncement("");
                void patch({ announcement: null }, "공지를 지웠습니다");
              }}
            >
              지우기
            </Button>
          )}
        </form>
        {cohort.announcement && (
          <p className="mt-2 text-xs text-slate-500">
            현재 표시 중인 공지: <span className="font-medium text-slate-700">{cohort.announcement}</span>
          </p>
        )}
      </Card>
      <ErrorText>{error}</ErrorText>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="접속 중" value={`${online.size}/${learners.length}`} />
        <Stat label="대화 중" value={activeCount} />
        <Stat label="완료한 대화" value={sessions.filter((s) => s.status !== "active").length} sub={pending ? `평가 대기 ${pending}` : undefined} />
        <Stat label="평균 점수" value={avgScore ?? "-"} />
        <Stat
          label="필수 시나리오 완료"
          value={`${learners.filter((l) => required.every((r) => (byLearner.get(l.userId) ?? []).some((s) => s.scenarioId === r.id && s.status !== "active"))).length}명`}
        />
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(
          [
            ["live", "실시간"],
            ["analysis", "분석·디브리핑"],
            ["learners", "수강생"],
            ["export", "내보내기"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <LiveView
          learners={learners}
          byLearner={byLearner}
          online={online}
          now={now}
          scenarioTitle={scenarioTitle}
          requiredCount={required.length}
          requiredIds={new Set(required.map((r) => r.id))}
          cohortId={cohort.id}
        />
      )}
      {tab === "analysis" && (
        <AnalysisView
          cohortId={cohort.id}
          scenarios={scenarios}
          sessions={sessions}
          competencyAvg={props.competencyAvg}
          summary={props.summary}
          onRequestSummary={requestSummary}
          busy={busy}
          scoredCount={scored.length}
        />
      )}
      {tab === "learners" && <LearnersTable cohortId={cohort.id} learners={learners} byLearner={byLearner} scenarios={scenarios} />}
      {tab === "export" && (
        <Card>
          <CardTitle>내보내기</CardTitle>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/cohorts/${cohort.id}/export`}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              수강생별 점수표 (Excel)
            </a>
            <LinkButton href={`/instructor/cohorts/${cohort.id}/print`} variant="secondary">
              리포트 일괄 인쇄 / PDF
            </LinkButton>
            <LinkButton href={`/instructor/cohorts/${cohort.id}/present`} variant="secondary">
              디브리핑 발표 화면
            </LinkButton>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Excel에는 수강생별 시도 이력·역량 점수·대화 로그 시트가 들어갑니다. 리포트 일괄 인쇄 화면에서 브라우저 인쇄의 &lsquo;PDF로 저장&rsquo;을 선택하세요.
          </p>
        </Card>
      )}
    </div>
  );
}

function LiveView({
  learners,
  byLearner,
  online,
  now,
  scenarioTitle,
  requiredCount,
  requiredIds,
  cohortId,
}: {
  learners: DashLearner[];
  byLearner: Map<string, DashSession[]>;
  online: Map<string, { activity: string }>;
  now: number;
  scenarioTitle: Map<string, string>;
  requiredCount: number;
  requiredIds: Set<string>;
  cohortId: string;
}) {
  if (learners.length === 0) return <EmptyState title="아직 입장한 수강생이 없습니다.">입장 코드를 눌러 QR을 띄워 주세요.</EmptyState>;
  // 쉬운 설명: 카드 순서 = 도움 필요(문제 많은 순) → 대화 중 → 접속 대기 → 오프라인. 같은 그룹 안에서는 이름순.
  const rank = (x: { ss: DashSession[]; flags: string[]; l: DashLearner }) => {
    if (x.flags.length > 0) return 0;
    if (x.ss.some((s) => s.status === "active")) return 1;
    if (online.has(x.l.userId)) return 2;
    return 3;
  };
  const withFlags = learners
    .map((l) => ({ l, ss: byLearner.get(l.userId) ?? [], flags: flagsFor(byLearner.get(l.userId) ?? [], now) }))
    .sort((a, b) => rank(a) - rank(b) || b.flags.length - a.flags.length || a.l.name.localeCompare(b.l.name, "ko"));
  const needHelp = withFlags.filter((x) => x.flags.length > 0);
  return (
    <div className="space-y-5">
      {needHelp.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardTitle>도움이 필요한 수강생 {needHelp.length}명</CardTitle>
          <div className="flex flex-wrap gap-2">
            {needHelp.map(({ l, ss, flags }) => {
              const active = ss.find((s) => s.status === "active");
              return (
                <Link
                  key={l.userId}
                  href={active ? `/instructor/sessions/${active.id}` : `/instructor/cohorts/${cohortId}/learners/${l.userId}`}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm hover:bg-rose-50"
                >
                  <span className="font-medium">{l.name}</span> <span className="text-rose-600">· {flags.join(", ")}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {withFlags.map(({ l, ss, flags }) => {
          const active = ss.find((s) => s.status === "active");
          const isOnline = online.has(l.userId);
          const done = new Set(ss.filter((s) => s.status !== "active" && requiredIds.has(s.scenarioId)).map((s) => s.scenarioId)).size;
          const last = ss.find((s) => s.score != null);
          const status = active ? "대화 중" : isOnline ? online.get(l.userId)?.activity === "대화 중" ? "대화 중" : "대기" : "오프라인";
          return (
            <Link
              key={l.userId}
              href={active ? `/instructor/sessions/${active.id}` : `/instructor/cohorts/${cohortId}/learners/${l.userId}`}
              className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${flags.length ? "border-rose-300" : "border-slate-200"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${active ? "animate-pulse bg-brand-500" : isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className="font-semibold">{l.name}</span>
                <span className="ml-auto text-xs text-slate-500">{status}</span>
              </div>
              <div className="mt-2 truncate text-sm text-slate-600">
                {active ? `▶ ${scenarioTitle.get(active.scenarioId)}` : last ? `최근: ${scenarioTitle.get(last.scenarioId)}` : "아직 시작 전"}
              </div>
              {active && (
                <div className="mt-1 text-xs text-slate-500">
                  {active.mode === "voice" ? "음성" : "텍스트"} · {active.turnCount}턴 · 고객 {emotionLabel(active.currentEmotion)}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full bg-brand-500" style={{ width: `${requiredCount ? (done / requiredCount) * 100 : 0}%` }} />
                </div>
                <span className="text-xs tabular-nums text-slate-500">
                  {done}/{requiredCount}
                </span>
                {last?.score != null && <span className="text-xs font-semibold tabular-nums">{Math.round(last.score)}점</span>}
              </div>
              {flags.length > 0 && <div className="mt-2 text-xs text-rose-600">{flags.join(" · ")}</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AnalysisView({
  cohortId,
  scenarios,
  sessions,
  competencyAvg,
  summary,
  onRequestSummary,
  busy,
  scoredCount,
}: {
  cohortId: string;
  scenarios: DashScenario[];
  sessions: DashSession[];
  competencyAvg: { label: string; avg: number; n: number }[];
  summary: { status: string; content: CohortSummary | null; evaluationCount: number; updatedAt: string } | null;
  onRequestSummary: () => void;
  busy: boolean;
  scoredCount: number;
}) {
  const scenStats = scenarios.map((s) => {
    const ss = sessions.filter((x) => x.scenarioId === s.id);
    const sc = ss.filter((x) => x.score != null);
    return {
      ...s,
      attempts: ss.length,
      learners: new Set(ss.filter((x) => x.status !== "active").map((x) => x.userId)).size,
      avg: sc.length ? Math.round(sc.reduce((a, x) => a + (x.score ?? 0), 0) / sc.length) : null,
    };
  });
  const buckets = [
    { range: "~59", n: 0 },
    { range: "60~69", n: 0 },
    { range: "70~79", n: 0 },
    { range: "80~89", n: 0 },
    { range: "90~", n: 0 },
  ];
  for (const s of sessions) {
    if (s.score == null) continue;
    const i = s.score < 60 ? 0 : s.score < 70 ? 1 : s.score < 80 ? 2 : s.score < 90 ? 3 : 4;
    buckets[i].n += 1;
  }
  const top = [...sessions].filter((s) => s.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle
          right={
            <div className="flex gap-2">
              <LinkButton href={`/instructor/cohorts/${cohortId}/present`} variant="secondary">
                발표 화면
              </LinkButton>
              <Button size="sm" onClick={onRequestSummary} disabled={busy || scoredCount === 0 || summary?.status === "pending"}>
                {summary?.status === "pending" ? "요약 생성 중…" : summary?.content ? "요약 다시 만들기" : "AI 요약 만들기"}
              </Button>
            </div>
          }
        >
          반 전체 AI 요약
        </CardTitle>
        {summary?.content ? (
          <SummaryBody s={summary.content} meta={`평가 ${summary.evaluationCount}건 기준 · ${fmtDateTime(summary.updatedAt)}`} />
        ) : (
          <p className="text-sm text-slate-500">
            {scoredCount === 0 ? "평가가 쌓이면 요약을 만들 수 있습니다." : "‘AI 요약 만들기’를 누르면 공통 강점·약점과 코칭 팁을 정리합니다."}
          </p>
        )}
        {summary?.status === "failed" && <p className="mt-2 text-sm text-rose-600">요약 생성에 실패했습니다. 다시 시도해 주세요.</p>}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle>역량별 평균</CardTitle>
          {competencyAvg.length === 0 ? (
            <p className="text-sm text-slate-500">평가가 아직 없습니다.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={competencyAvg} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}점`, "평균"]} />
                  <Bar dataKey="avg" fill="#2f6fed" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>점수 분포</CardTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={buckets}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}건`, "대화"]} />
                <Bar dataKey="n" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="p-5 pb-2">
          <CardTitle>시나리오별 현황</CardTitle>
        </div>
        <table className="w-full text-sm">
          <thead className="border-y border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-5 py-2 font-medium">시나리오</th>
              <th className="px-5 py-2 text-right font-medium">시도</th>
              <th className="px-5 py-2 text-right font-medium">완료 수강생</th>
              <th className="px-5 py-2 text-right font-medium">평균 점수</th>
            </tr>
          </thead>
          <tbody>
            {scenStats.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2">
                  {s.title} {s.required && <Badge tone="amber">필수</Badge>}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">{s.attempts}</td>
                <td className="px-5 py-2 text-right tabular-nums">{s.learners}</td>
                <td className="px-5 py-2 text-right tabular-nums">{s.avg ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardTitle>우수 응대 사례</CardTitle>
        {top.length === 0 ? (
          <p className="text-sm text-slate-500">평가가 아직 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {top.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-12 font-semibold tabular-nums">{Math.round(s.score!)}점</span>
                <span className="flex-1 text-slate-600">{s.summary}</span>
                <Link className="text-brand-600 hover:underline" href={`/instructor/sessions/${s.id}`}>
                  보기
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function SummaryBody({ s, meta, large }: { s: CohortSummary; meta?: string; large?: boolean }) {
  return (
    <div className={large ? "space-y-8 text-xl" : "space-y-4 text-sm"}>
      <p className={large ? "text-3xl font-bold" : "text-base font-semibold"}>{s.headline}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-emerald-700">공통 강점</h3>
          <ul className="space-y-2">
            {s.commonStrengths.map((x, i) => (
              <li key={i} className="rounded-lg bg-emerald-50 p-3">
                <div className="font-medium">{x.title}</div>
                <div className="text-slate-600">{x.detail}</div>
                {x.exampleQuote && <div className="mt-1 italic text-slate-500">&ldquo;{x.exampleQuote}&rdquo;</div>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-amber-700">공통 약점</h3>
          <ul className="space-y-2">
            {s.commonWeaknesses.map((x, i) => (
              <li key={i} className="rounded-lg bg-amber-50 p-3">
                <div className="font-medium">{x.title}</div>
                <div className="text-slate-600">{x.detail}</div>
                {x.exampleQuote && <div className="mt-1 italic text-slate-500">&ldquo;{x.exampleQuote}&rdquo;</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-brand-700">코칭 팁</h3>
        <ol className="list-decimal space-y-1 pl-5">
          {s.coachingTips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>
      {meta && <p className="text-xs text-slate-400">{meta}</p>}
    </div>
  );
}

function LearnersTable({
  cohortId,
  learners,
  byLearner,
  scenarios,
}: {
  cohortId: string;
  learners: DashLearner[];
  byLearner: Map<string, DashSession[]>;
  scenarios: DashScenario[];
}) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">이름</th>
            <th className="px-4 py-2 font-medium">소속</th>
            {scenarios.map((s) => (
              <th key={s.id} className="px-4 py-2 text-right font-medium">
                {s.title}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">평균</th>
          </tr>
        </thead>
        <tbody>
          {learners.map((l) => {
            const ss = byLearner.get(l.userId) ?? [];
            const scored = ss.filter((s) => s.score != null);
            const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length) : null;
            return (
              <tr key={l.userId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/instructor/cohorts/${cohortId}/learners/${l.userId}`} className="font-medium text-brand-600 hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{l.organization ?? "-"}</td>
                {scenarios.map((sc) => {
                  const best = ss
                    .filter((s) => s.scenarioId === sc.id && s.score != null)
                    .reduce<number | null>((m, s) => (m == null || (s.score ?? 0) > m ? s.score : m), null);
                  const tries = ss.filter((s) => s.scenarioId === sc.id).length;
                  return (
                    <td key={sc.id} className="px-4 py-2 text-right tabular-nums">
                      {best != null ? Math.round(best) : "-"}
                      {tries > 0 && <span className="ml-1 text-xs text-slate-400">({tries})</span>}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{avg ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
