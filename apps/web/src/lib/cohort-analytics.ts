/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사용 '심화 분석' 화면에 필요한 숫자를 한 교육 차수 단위로 계산합니다.
 *      참여·완료율, 응대 습관(쿠션어·공감·사과·말버릇·금지 표현), 재도전에 따른 점수 변화, 자주 빠뜨리는 단계,
 *      시나리오별 실제 난이도, 수강생별 습관, 수강생 구성(경력·직무·입장 방법)을 만듭니다.
 * 언제: 강사 → 교육 차수 → '심화 분석', 관리자 → 분석(차수 비교표, summarizeCohort 만 사용).
 * 리뷰 포인트:
 *  - '완료'는 내 교육 화면과 같은 기준입니다: 끝까지 했든 중간에 끝냈든 대화가 끝났으면 완료(진행 중만 제외).
 *  - 응대 습관 숫자는 상시 서버가 계산해 둔 실습별 분석(session_analytics)의 평균입니다. 11/18 이후 실습부터 있습니다.
 *  - '첫 시도 → 최근 시도'는 같은 수강생이 같은 시나리오를 2번 이상 한 경우만 비교합니다.
 *  - 강사가 점수를 고친 경우 고친 점수를 씁니다(대시보드와 같음).
 * =====================
 */
import "server-only";
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  CAREER_BANDS,
  findJob,
  LEXICON_CATEGORIES,
  type Competency,
  type LexiconCategory,
} from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";
import { loadCohortDashboard, type CohortDashboardData, type DashSession } from "@/lib/cohort-data";

/** 상시 서버가 저장한 실습 1회 분석 (필요한 칸만) */
interface SaRow {
  session_id: string;
  user_id: string;
  mode: string | null;
  duration_sec: number | null;
  avg_latency_sec: number | null;
  avg_learner_chars: number | null;
  talk_ratio: number | null;
  filler_count: number;
  forbidden_count: number;
  cushion_rate: number | null;
  apology_rate: number | null;
  empathy_rate: number | null;
  filler_rate: number | null;
  forbidden_rate: number | null;
  question_rate: number | null;
  chars_per_sec: number | null;
  phrase_counts: Partial<Record<LexiconCategory, Record<string, number>>> | null;
  top_ngrams: [string, number][] | null;
}

export const HABITS = [
  { key: "cushion_rate", label: "쿠션어", good: true },
  { key: "empathy_rate", label: "공감 표현", good: true },
  { key: "apology_rate", label: "사과", good: true },
  { key: "question_rate", label: "질문", good: true },
  { key: "filler_rate", label: "말버릇", good: false },
  { key: "forbidden_rate", label: "금지 표현", good: false },
] as const;
export type HabitKey = (typeof HABITS)[number]["key"];

const EARLY_END = new Set(["learner_ended", "abandoned"]);

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && !Number.isNaN(Number(x))).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const round = (x: number | null, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const minutesOf = (s: DashSession) =>
  s.endedAt ? Math.max(0, (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) : null;

/** 같은 수강생·같은 시나리오 안에서 몇 번째 시도인지 (시작 시각 순, 1부터) */
function attemptNumbers(sessions: DashSession[]) {
  const byPair = new Map<string, DashSession[]>();
  for (const s of sessions) {
    const k = `${s.userId}:${s.scenarioId}`;
    byPair.set(k, [...(byPair.get(k) ?? []), s]);
  }
  const no = new Map<string, number>();
  for (const list of byPair.values()) {
    list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    list.forEach((s, i) => no.set(s.id, i + 1));
  }
  return { no, byPair };
}

/** 첫 시도와 최근 시도를 짝지어 평균 비교 (2번 이상 한 수강생·시나리오만) */
function firstVsLast<T>(byPair: Map<string, DashSession[]>, pick: (s: DashSession) => T | null, val: (t: T) => number | null) {
  const first: number[] = [];
  const last: number[] = [];
  for (const list of byPair.values()) {
    const vals = list.map((s) => pick(s)).filter((t): t is T => t != null).map(val).filter((x): x is number => x != null);
    if (vals.length < 2) continue;
    first.push(vals[0]);
    last.push(vals[vals.length - 1]);
  }
  return { first: avg(first), last: avg(last), pairs: first.length };
}

export interface CohortSummaryRow {
  enrolled: number;
  practiced: number;
  participationRate: number | null;
  requiredDoneRate: number | null;
  sessions: number;
  avgScore: number | null;
  totalMinutes: number;
  avgMinutesPerLearner: number | null;
  earlyEndRate: number | null;
  retryRate: number | null;
  habits: Record<HabitKey, number | null>;
  analyzedSessions: number;
}

function summarize(d: CohortDashboardData, sa: SaRow[]): CohortSummaryRow {
  const enrolled = d.learners.length;
  const finished = d.sessions.filter((s) => s.status !== "active");
  const practicedSet = new Set(finished.map((s) => s.userId));
  const required = d.scenarios.filter((s) => s.required).map((s) => s.id);
  const doneAll = required.length
    ? d.learners.filter((l) => required.every((rid) => finished.some((s) => s.userId === l.userId && s.scenarioId === rid))).length
    : null;
  const totalMinutes = finished.reduce((a, s) => a + (minutesOf(s) ?? 0), 0);
  const ended = finished.filter((s) => s.endReason);
  const { byPair } = attemptNumbers(finished);
  const retried = new Set([...byPair.values()].filter((l) => l.length >= 2).map((l) => l[0].userId));
  return {
    enrolled,
    practiced: practicedSet.size,
    participationRate: enrolled ? practicedSet.size / enrolled : null,
    requiredDoneRate: doneAll != null && enrolled ? doneAll / enrolled : null,
    sessions: finished.length,
    avgScore: round(avg(d.sessions.map((s) => s.score))),
    totalMinutes: Math.round(totalMinutes),
    avgMinutesPerLearner: practicedSet.size ? Math.round(totalMinutes / practicedSet.size) : null,
    earlyEndRate: ended.length ? ended.filter((s) => EARLY_END.has(s.endReason!)).length / ended.length : null,
    retryRate: practicedSet.size ? retried.size / practicedSet.size : null,
    habits: Object.fromEntries(HABITS.map((h) => [h.key, round(avg(sa.map((r) => r[h.key])), 1)])) as Record<HabitKey, number | null>,
    analyzedSessions: sa.length,
  };
}

async function loadSa(cohortIds: string[]): Promise<Map<string, SaRow[]>> {
  const out = new Map<string, SaRow[]>();
  if (!cohortIds.length) return out;
  const { data, error } = await adminClient()
    .from("session_analytics")
    .select(
      "session_id, user_id, cohort_id, mode, duration_sec, avg_latency_sec, avg_learner_chars, talk_ratio, filler_count, forbidden_count, cushion_rate, apology_rate, empathy_rate, filler_rate, forbidden_rate, question_rate, chars_per_sec, phrase_counts, top_ngrams",
    )
    .in("cohort_id", cohortIds);
  if (error) return out; // 표가 아직 없으면(SQL 실행 전) 빈 값
  for (const r of (data ?? []) as (SaRow & { cohort_id: string })[]) out.set(r.cohort_id, [...(out.get(r.cohort_id) ?? []), r]);
  return out;
}

/** 관리자 차수 비교표용: 여러 차수의 요약만 */
export async function summarizeCohorts(cohortIds: string[]) {
  const sa = await loadSa(cohortIds);
  const out = new Map<string, CohortSummaryRow>();
  const ds = await Promise.all(cohortIds.map((id) => loadCohortDashboard(id)));
  cohortIds.forEach((id, i) => out.set(id, summarize(ds[i], sa.get(id) ?? [])));
  return out;
}

export async function loadCohortAnalytics(cohortId: string) {
  const d = await loadCohortDashboard(cohortId);
  const [saMap, { data: enr }] = await Promise.all([
    loadSa([cohortId]),
    adminClient().from("enrollments").select("user_id, entry_source, profiles(career, job_id)").eq("cohort_id", cohortId),
  ]);
  const sa = saMap.get(cohortId) ?? [];
  const saBySession = new Map(sa.map((r) => [r.session_id, r]));
  const summary = summarize(d, sa);
  const finished = d.sessions.filter((s) => s.status !== "active");
  const { no, byPair } = attemptNumbers(finished);
  const title = new Map(d.scenarios.map((s) => [s.id, s.title]));

  // ── 응대 습관: 첫 시도 → 최근 시도
  const habitChange = HABITS.map((h) => {
    const r = firstVsLast(byPair, (s) => saBySession.get(s.id) ?? null, (x) => (x[h.key] == null ? null : Number(x[h.key])));
    return { ...h, avg: summary.habits[h.key], first: round(r.first, 1), last: round(r.last, 1), pairs: r.pairs };
  });
  const extra = {
    latency: round(avg(sa.map((r) => r.avg_latency_sec)), 1),
    chars: round(avg(sa.map((r) => r.avg_learner_chars))),
    talk: round(avg(sa.map((r) => r.talk_ratio)), 2),
    speed: round(avg(sa.map((r) => r.chars_per_sec)), 1),
  };

  // ── 많이 쓴 표현 (분류별 상위 6개)
  const phraseTop = Object.fromEntries(
    LEXICON_CATEGORIES.map((c) => {
      const m = new Map<string, number>();
      for (const r of sa) for (const [p, n] of Object.entries(r.phrase_counts?.[c] ?? {})) m.set(p, (m.get(p) ?? 0) + Number(n || 0));
      return [c, [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)];
    }),
  ) as Record<LexiconCategory, [string, number][]>;

  // ── 자주 반복된 말 묶음 (여러 수강생이 반복한 말 = 반 전체 말버릇 후보)
  const ngram = new Map<string, { n: number; users: Set<string> }>();
  for (const r of sa)
    for (const [g, n] of r.top_ngrams ?? []) {
      const e = ngram.get(g) ?? { n: 0, users: new Set<string>() };
      e.n += Number(n || 0);
      e.users.add(r.user_id);
      ngram.set(g, e);
    }
  const repeated = [...ngram.entries()]
    .map(([g, e]) => ({ phrase: g, count: e.n, learners: e.users.size }))
    .sort((a, b) => b.learners - a.learners || b.count - a.count)
    .slice(0, 8);

  // ── 재도전에 따른 점수 변화 (1·2·3·4회차 이상)
  const byAttempt = new Map<number, number[]>();
  for (const s of finished) {
    if (s.score == null) continue;
    const k = Math.min(no.get(s.id) ?? 1, 4);
    byAttempt.set(k, [...(byAttempt.get(k) ?? []), s.score]);
  }
  const attemptTrend = [1, 2, 3, 4]
    .filter((k) => byAttempt.has(k))
    .map((k) => ({ x: k, score: Math.round(avg(byAttempt.get(k)!)!), label: `${k === 4 ? "4회차 이상" : `${k}회차`} · ${byAttempt.get(k)!.length}건` }));

  // ── 역량별 첫 시도 → 최근 시도
  const compChange = COMPETENCIES.map((c: Competency) => {
    const scoreOf = (s: DashSession) => d.results.get(s.id)?.competencyScores.find((x) => x.competency === c)?.score ?? null;
    const r = firstVsLast(byPair, scoreOf, (x) => x);
    const all = avg(finished.map(scoreOf));
    return { competency: c, label: COMPETENCY_LABELS[c], avg: round(all), first: round(r.first), last: round(r.last), pairs: r.pairs };
  }).filter((x) => x.avg != null);

  // ── 자주 빠뜨리는 필수 단계 / 안내
  const steps = new Map<string, { miss: number; total: number }>();
  const missed = new Map<string, { n: number; wrong: number }>();
  for (const s of finished) {
    const r = d.results.get(s.id);
    if (!r) continue;
    for (const c of r.checklist ?? []) {
      const k = `${title.get(s.scenarioId) ?? ""}|${c.label}`;
      const e = steps.get(k) ?? { miss: 0, total: 0 };
      e.total += 1;
      if (!c.done) e.miss += 1;
      steps.set(k, e);
    }
    for (const m of r.missedInfo ?? []) {
      const k = `${title.get(s.scenarioId) ?? ""}|${m.item.trim()}`;
      const e = missed.get(k) ?? { n: 0, wrong: 0 };
      e.n += 1;
      if (m.kind === "wrong") e.wrong += 1;
      missed.set(k, e);
    }
  }
  const missedSteps = [...steps.entries()]
    .filter(([, e]) => e.miss > 0)
    .map(([k, e]) => ({ scenario: k.split("|")[0], label: k.split("|").slice(1).join("|"), miss: e.miss, total: e.total, rate: e.miss / e.total }))
    .sort((a, b) => b.rate - a.rate || b.miss - a.miss)
    .slice(0, 8);
  const missedInfo = [...missed.entries()]
    .map(([k, e]) => ({ scenario: k.split("|")[0], item: k.split("|").slice(1).join("|"), n: e.n, wrong: e.wrong }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  // ── 시나리오별 실제 난이도
  const scenarioStats = d.scenarios.map((sc) => {
    const ss = finished.filter((s) => s.scenarioId === sc.id);
    const ended = ss.filter((s) => s.endReason);
    return {
      id: sc.id,
      title: sc.title,
      required: sc.required,
      attempts: ss.length,
      learners: new Set(ss.map((s) => s.userId)).size,
      avgScore: round(avg(ss.map((s) => s.score))),
      firstScore: round(avg(ss.filter((s) => no.get(s.id) === 1).map((s) => s.score))),
      earlyEnd: ended.length ? ended.filter((s) => EARLY_END.has(s.endReason!)).length / ended.length : null,
      minutes: round(avg(ss.map(minutesOf)), 1),
    };
  });

  // ── 수강생별 습관
  const learnerRows = d.learners.map((l) => {
    const ss = finished.filter((s) => s.userId === l.userId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const scored = ss.filter((s) => s.score != null);
    const rows = ss.map((s) => saBySession.get(s.id)).filter((r): r is SaRow => !!r);
    const g = new Map<string, number>();
    for (const r of rows) for (const [p, n] of r.top_ngrams ?? []) g.set(p, (g.get(p) ?? 0) + Number(n || 0));
    const topPhrase = [...g.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      userId: l.userId,
      name: l.name,
      sessions: ss.length,
      avgScore: round(avg(scored.map((s) => s.score))),
      change: scored.length >= 2 ? Math.round(scored[scored.length - 1].score! - scored[0].score!) : null,
      cushion: round(avg(rows.map((r) => r.cushion_rate))),
      empathy: round(avg(rows.map((r) => r.empathy_rate))),
      filler: round(avg(rows.map((r) => r.filler_rate))),
      forbidden: rows.reduce((a, r) => a + (r.forbidden_count ?? 0), 0),
      topPhrase: topPhrase && topPhrase[1] >= 2 ? topPhrase[0] : null,
      analyzed: rows.length,
    };
  });

  // ── 수강생 구성
  type EnrRow = { user_id: string; entry_source: string | null; profiles: { career: string | null; job_id: string | null } | null };
  const enrRows = (enr ?? []) as unknown as EnrRow[];
  const countBy = (keys: string[]) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const ENTRY: Record<string, string> = { qr: "QR 촬영", link: "공유 주소", code: "코드 직접 입력" };
  const makeup = {
    career: countBy(enrRows.map((e) => CAREER_BANDS.find((c) => c.id === e.profiles?.career)?.label ?? "미입력")),
    job: countBy(enrRows.map((e) => findJob(e.profiles?.job_id)?.category.label ?? (e.profiles?.job_id ? "기타" : "미입력"))),
    entry: countBy(enrRows.map((e) => (e.entry_source ? (ENTRY[e.entry_source] ?? e.entry_source) : "기록 없음"))),
  };

  return {
    cohort: d.cohort,
    summary,
    habitChange,
    extra,
    phraseTop,
    repeated,
    attemptTrend,
    compChange,
    missedSteps,
    missedInfo,
    scenarioStats,
    learnerRows,
    makeup,
  };
}
