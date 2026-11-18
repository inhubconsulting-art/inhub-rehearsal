/**
 * ===== 쉬운 설명 =====
 * 무엇: '연습하기' 화면 (시나리오 라이브러리). 교육 코드 없이 원하는 시나리오로 바로 연습합니다.
 * 언제: 왼쪽 메뉴 '연습하기' 또는 '연습 시작' 버튼.
 * 리뷰 포인트:
 *  - 운영자가 '개인 연습에 공개'를 켠 게시된 시나리오만 보입니다.
 *  - 시작하면 이용권 1회가 차감됩니다(교육 과정 실습은 차감 없음). 업종·유형·난이도·검색으로 걸러 볼 수 있어요.
 * =====================
 */
import Link from "next/link";
import clsx from "clsx";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
  SCENARIO_TYPES,
  SCENARIO_TYPE_LABELS,
} from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { loadScenarioContent } from "@/lib/domain";
import { getPassBalance, getPracticeCohortId, listPracticeScenarios } from "@/lib/practice";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";

type SP = { industry?: string; type?: string; difficulty?: string; q?: string };

export default async function PracticeLibrary({ searchParams }: { searchParams: Promise<SP> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const [all, balance, cohortId] = await Promise.all([listPracticeScenarios(), getPassBalance(u.id), getPracticeCohortId()]);

  // 쉬운 설명: 내가 이 시나리오로 개인 연습해서 받은 최고 점수
  const best = new Map<string, number>();
  if (cohortId) {
    const { data } = await adminClient()
      .from("sessions")
      .select("scenario_id, evaluations(total_score)")
      .eq("user_id", u.id)
      .eq("cohort_id", cohortId);
    for (const r of (data ?? []) as unknown as { scenario_id: string; evaluations: { total_score: number } | { total_score: number }[] | null }[]) {
      const ev = Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations;
      if (ev) best.set(r.scenario_id, Math.max(best.get(r.scenario_id) ?? 0, Number(ev.total_score)));
    }
  }

  const q = (sp.q ?? "").trim();
  const list = all.filter(
    (s) =>
      (!sp.industry || s.industry === sp.industry) &&
      (!sp.type || s.type === sp.type) &&
      (!sp.difficulty || s.difficulty === sp.difficulty) &&
      (!q || s.title.includes(q)),
  );
  const contents = await Promise.all(list.map((s) => loadScenarioContent(s.id, s.current_version).catch(() => null)));

  // 거르기 칩: 누르면 그 조건만 바꾼 주소로 이동 (다시 누르면 해제)
  const href = (k: keyof SP, v: string | undefined) => {
    const p = new URLSearchParams();
    for (const key of ["industry", "type", "difficulty", "q"] as const) {
      const val = key === k ? v : sp[key];
      if (val) p.set(key, val);
    }
    const s = p.toString();
    return s ? `/practice?${s}` : "/practice";
  };
  const chip = (k: keyof SP, v: string | undefined, label: string) => {
    const on = (sp[k] ?? undefined) === v;
    return (
      <Link
        key={`${k}-${v ?? "all"}`}
        href={href(k, v)}
        aria-current={on ? "true" : undefined}
        className={clsx(
          "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm",
          on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50",
        )}
      >
        {label}
      </Link>
    );
  };
  const presentIndustries = INDUSTRIES.filter((i) => all.some((s) => s.industry === i));

  return (
    <AppShell user={u} wide>
      <PageHeader
        title="연습하기"
        description="교육 코드 없이 원하는 시나리오로 바로 연습해요. 시작할 때 이용권 1회가 차감돼요."
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 text-sm">
            남은 이용권 <b>{balance ?? "-"}회</b>
            <LinkButton href="/pass" variant="secondary">
              이용권
            </LinkButton>
          </div>
        }
      />

      <div className="mb-5 space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-sm font-semibold text-slate-500">업종</span>
          {chip("industry", undefined, "전체")}
          {presentIndustries.map((i) => chip("industry", i, INDUSTRY_LABELS[i]))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-sm font-semibold text-slate-500">유형</span>
          {chip("type", undefined, "전체")}
          {SCENARIO_TYPES.map((t) => chip("type", t, SCENARIO_TYPE_LABELS[t]))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-sm font-semibold text-slate-500">난이도</span>
          {chip("difficulty", undefined, "전체")}
          {DIFFICULTIES.map((d) => chip("difficulty", d, DIFFICULTY_LABELS[d]))}
          <form className="ml-auto flex items-center gap-2" action="/practice">
            {sp.industry && <input type="hidden" name="industry" value={sp.industry} />}
            {sp.type && <input type="hidden" name="type" value={sp.type} />}
            {sp.difficulty && <input type="hidden" name="difficulty" value={sp.difficulty} />}
            <label htmlFor="q" className="text-sm text-slate-500">
              검색
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="시나리오 이름" className="h-9 w-48 rounded-full border border-slate-200 px-3.5 text-sm" />
          </form>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-500">
        시나리오 <b className="text-slate-800">{list.length}개</b>
      </p>

      {all.length === 0 ? (
        <EmptyState title="아직 개인 연습에 공개된 시나리오가 없어요.">운영자가 시나리오를 공개하면 여기에 나타나요.</EmptyState>
      ) : list.length === 0 ? (
        <EmptyState title="조건에 맞는 시나리오가 없어요.">
          <Link href="/practice" className="text-brand-600 underline">
            거르기 초기화
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => {
            const c = contents[i];
            const mine = best.get(s.id);
            return (
              <article key={s.id} className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{INDUSTRY_LABELS[s.industry as keyof typeof INDUSTRY_LABELS] ?? s.industry}</Badge>
                  <Badge tone={s.type === "complaint" ? "rose" : s.type === "retention" ? "amber" : "blue"}>
                    {SCENARIO_TYPE_LABELS[s.type as keyof typeof SCENARIO_TYPE_LABELS] ?? s.type}
                  </Badge>
                  <Badge>난이도 {DIFFICULTY_LABELS[s.difficulty as keyof typeof DIFFICULTY_LABELS] ?? s.difficulty}</Badge>
                </div>
                <h2 className="text-base font-bold">{s.title}</h2>
                {c && <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{c.briefing.summary}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {c && <span>약 {Math.round(c.timeLimitSec / 60)}분</span>}
                  {c && <span>{c.channel === "phone" ? "전화(음성 추천)" : "채팅"}</span>}
                  <span>{mine != null ? <>내 최고 <b className="text-slate-800">{mine}점</b></> : "아직 안 해 봄"}</span>
                </div>
                <div className="mt-auto pt-2">
                  <LinkButton href={`/practice/${s.id}`}>브리핑 보고 시작</LinkButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
