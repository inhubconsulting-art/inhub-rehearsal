/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사용 '심화 분석' 화면. 한 교육 차수의 참여·완료율, 응대 습관(쿠션어·공감·말버릇·금지 표현 등),
 *      재도전에 따른 점수·습관 변화, 자주 빠뜨리는 단계와 안내, 시나리오별 실제 난이도, 수강생별 습관, 수강생 구성을 보여 줍니다.
 * 언제: 강사 대시보드 위쪽 '📊 심화 분석' 또는 '분석·디브리핑' 탭의 버튼. 관리자 → 분석의 차수 이름.
 * 리뷰 포인트: 계산 방법은 lib/cohort-analytics.ts 에 있습니다. 응대 습관은 11/18 이후 실습부터 쌓이므로 처음엔 비어 있을 수 있어요.
 *         수강생 이름이 나오므로 담당 강사와 관리자만 볼 수 있습니다.
 * =====================
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LEXICON_CATEGORY_LABELS, type LexiconCategory } from "@inhub/shared";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { loadCohortAnalytics } from "@/lib/cohort-analytics";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";
import { ScoreTrend } from "@/components/ScoreTrend";

const pct = (x: number | null, d = 0) => (x == null ? "-" : `${(x * 100).toFixed(d)}%`);
const num = (x: number | null, unit = "") => (x == null ? "-" : `${x}${unit}`);

function Bar({ value, max = 100, tone = "bg-brand-500" }: { value: number | null; max?: number; tone?: string }) {
  const w = value == null ? 0 : Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${w}%` }} />
    </span>
  );
}

function Delta({ from, to, good = true, unit = "" }: { from: number | null; to: number | null; good?: boolean; unit?: string }) {
  if (from == null || to == null) return <span className="text-slate-400">-</span>;
  const d = Math.round((to - from) * 10) / 10;
  if (d === 0) return <span className="text-slate-500">변화 없음</span>;
  const better = good ? d > 0 : d < 0;
  return (
    <span className={better ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}
      {unit}
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {hint && <p className="-mt-2 mb-3 text-xs text-slate-500">{hint}</p>}
      {children}
    </Card>
  );
}

function CountList({ rows, total }: { rows: [string, number][]; total: number }) {
  if (!rows.length) return <p className="text-sm text-slate-400">아직 없어요.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(([k, n]) => (
        <li key={k} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2">
          <span className="truncate text-slate-600">{k}</span>
          <Bar value={n} max={total || 1} tone="bg-slate-400" />
          <span className="text-right tabular-nums">{n}명</span>
        </li>
      ))}
    </ul>
  );
}

export default async function CohortAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const a = await loadCohortAnalytics(id);
  const s = a.summary;
  const retried = a.habitChange.some((h) => h.pairs > 0);
  const compRetried = a.compChange.some((c) => c.pairs > 0);
  const order: LexiconCategory[] = ["cushion", "empathy", "apology", "filler", "forbidden"];

  return (
    <AppShell user={u} wide>
      <PageHeader
        title={`심화 분석 · ${a.cohort.title}`}
        description="참여, 응대 습관, 재도전 효과, 자주 놓치는 부분을 한눈에 봅니다. 숫자는 들어올 때마다 새로 계산돼요."
        actions={
          <LinkButton href={`/instructor/cohorts/${id}`} variant="secondary">
            ← 대시보드
          </LinkButton>
        }
      />

      {s.sessions === 0 ? (
        <EmptyState title="아직 끝난 실습이 없어요.">수강생이 실습을 마치면 여기에 분석이 쌓입니다.</EmptyState>
      ) : (
        <div className="space-y-5">
          {/* ① 요약 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="실습 참여" value={`${s.practiced}/${s.enrolled}명`} sub={pct(s.participationRate)} />
            <Stat label="필수 과정 완료율" value={pct(s.requiredDoneRate)} sub="필수 시나리오를 모두 마친 비율" />
            <Stat label="평균 점수" value={num(s.avgScore, "점")} sub={`실습 ${s.sessions}회`} />
            <Stat label="1인 평균 학습 시간" value={num(s.avgMinutesPerLearner, "분")} sub={`전체 ${s.totalMinutes}분`} />
            <Stat label="재도전한 수강생" value={pct(s.retryRate)} sub="같은 시나리오 2번 이상" />
            <Stat label="중도 종료" value={pct(s.earlyEndRate)} sub="수강생이 끝냄·응답 없음" />
          </div>

          {/* ② 응대 습관 */}
          <Section
            title="응대 습관"
            hint={`표현이 한 번이라도 들어간 수강생 발화의 비율이에요 (분석된 실습 ${s.analyzedSessions}회 기준).${retried ? " 오른쪽은 같은 시나리오를 다시 했을 때의 변화예요." : ""}`}
          >
            {s.analyzedSessions === 0 ? (
              <p className="text-sm text-slate-500">아직 분석된 실습이 없어요. 대화 분석은 11/18 이후 실습부터 쌓입니다.</p>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {a.habitChange.map((h) => (
                    <li key={h.key} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[6rem_1fr_3.5rem_11rem]">
                      <span className="font-medium">{h.label}</span>
                      <Bar value={h.avg} tone={h.good ? "bg-brand-500" : "bg-amber-500"} />
                      <span className="text-right tabular-nums">{num(h.avg, "%")}</span>
                      <span className="hidden text-xs text-slate-500 sm:block">
                        {h.pairs > 0 ? (
                          <>
                            첫 {num(h.first, "%")} → 최근 {num(h.last, "%")} <Delta from={h.first} to={h.last} good={h.good} unit="%p" />
                          </>
                        ) : (
                          "재도전 기록 없음"
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-slate-500">평균 응답 시간 (텍스트)</div>
                    <div className="font-semibold">{num(a.extra.latency, "초")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">평균 발화 길이</div>
                    <div className="font-semibold">{num(a.extra.chars, "자")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">수강생 말 비중</div>
                    <div className="font-semibold">{a.extra.talk == null ? "-" : `${Math.round(a.extra.talk * 100)}%`}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">말 속도 (음성)</div>
                    <div className="font-semibold">{num(a.extra.speed, "자/초")}</div>
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ③ 많이 쓴 표현 */}
          {s.analyzedSessions > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="많이 쓴 표현" hint="분류별로 가장 많이 나온 표현이에요 (괄호는 횟수).">
                <dl className="space-y-2 text-sm">
                  {order.map((c) => (
                    <div key={c} className="grid grid-cols-[6.5rem_1fr] gap-2">
                      <dt className="text-slate-500">{LEXICON_CATEGORY_LABELS[c]}</dt>
                      <dd className={c === "forbidden" && a.phraseTop[c].length ? "text-rose-700" : ""}>
                        {a.phraseTop[c].length ? a.phraseTop[c].map(([p, n]) => `${p}(${n})`).join(", ") : <span className="text-slate-400">없음</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
              <Section title="반 전체가 자주 반복한 말" hint="여러 수강생이 반복해서 쓴 말 묶음이에요. 반 전체 말버릇 후보로 디브리핑에 써 보세요.">
                {a.repeated.length === 0 ? (
                  <p className="text-sm text-slate-400">아직 없어요.</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {a.repeated.map((r) => (
                      <li key={r.phrase} className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">&ldquo;{r.phrase}&rdquo;</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {r.learners}명 · {r.count}회
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>
          )}

          {/* ④ 재도전 효과 */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="재도전에 따른 점수 변화" hint="같은 시나리오를 몇 번째 했는지에 따른 평균 점수예요.">
              {a.attemptTrend.length < 2 ? (
                <p className="text-sm text-slate-500">재도전 기록이 쌓이면 보여요. (지금은 {a.attemptTrend[0]?.label ?? "기록 없음"})</p>
              ) : (
                <ScoreTrend data={a.attemptTrend} />
              )}
            </Section>
            <Section title="역량별 점수" hint={compRetried ? "평균과, 다시 했을 때 첫 시도 → 최근 시도 변화예요." : "역량별 평균 점수예요. 낮은 역량을 디브리핑 주제로 잡아 보세요."}>
              {a.compChange.length === 0 ? (
                <p className="text-sm text-slate-400">평가가 아직 없어요.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {[...a.compChange]
                    .sort((x, y) => (x.avg ?? 0) - (y.avg ?? 0))
                    .map((c) => (
                      <li key={c.competency} className="grid grid-cols-[8.5rem_1fr_2.5rem_5rem] items-center gap-2">
                        <span className="truncate">{c.label}</span>
                        <Bar value={c.avg} />
                        <span className="text-right tabular-nums">{c.avg}</span>
                        <span className="text-right text-xs">{c.pairs > 0 ? <Delta from={c.first} to={c.last} unit="점" /> : ""}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Section>
          </div>

          {/* ⑤ 자주 놓치는 부분 */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="자주 빠뜨리는 필수 단계" hint="평가에서 '못 함'으로 나온 비율이 높은 단계예요.">
              {a.missedSteps.length === 0 ? (
                <p className="text-sm text-slate-400">빠뜨린 단계가 없어요.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {a.missedSteps.map((m) => (
                    <li key={m.scenario + m.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{m.label}</span>
                        <span className="shrink-0 tabular-nums text-rose-700">
                          {pct(m.rate)} <span className="text-xs text-slate-500">({m.miss}/{m.total})</span>
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{m.scenario}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="자주 빠뜨리거나 틀린 안내" hint="고객이 묻지 않아도 안내했어야 하는데 놓친 내용이에요.">
              {a.missedInfo.length === 0 ? (
                <p className="text-sm text-slate-400">놓친 안내가 없어요.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {a.missedInfo.map((m) => (
                    <li key={m.scenario + m.item}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{m.item}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {m.n}회{m.wrong > 0 && <span className="text-rose-700"> (틀림 {m.wrong})</span>}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{m.scenario}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* ⑥ 시나리오별 실제 난이도 */}
          <Card className="p-0">
            <div className="p-5 pb-2">
              <CardTitle>시나리오별 실제 난이도</CardTitle>
              <p className="-mt-2 text-xs text-slate-500">첫 시도 평균이 낮고 중도 종료가 많을수록 수강생에게 어려운 시나리오예요.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-y border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">시나리오</th>
                    <th className="px-3 py-2 text-right font-medium">시도</th>
                    <th className="px-3 py-2 text-right font-medium">수강생</th>
                    <th className="px-3 py-2 text-right font-medium">첫 시도 평균</th>
                    <th className="px-3 py-2 text-right font-medium">전체 평균</th>
                    <th className="px-3 py-2 text-right font-medium">평균 시간</th>
                    <th className="px-5 py-2 text-right font-medium">중도 종료</th>
                  </tr>
                </thead>
                <tbody>
                  {a.scenarioStats.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2">
                        {r.title} {r.required && <Badge tone="amber">필수</Badge>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.attempts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.learners}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.firstScore)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.avgScore)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.minutes, "분")}</td>
                      <td className={`px-5 py-2 text-right tabular-nums ${(r.earlyEnd ?? 0) >= 0.3 ? "font-semibold text-rose-700" : ""}`}>{pct(r.earlyEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ⑦ 수강생별 습관 */}
          <Card className="p-0">
            <div className="p-5 pb-2">
              <CardTitle>수강생별 응대 습관</CardTitle>
              <p className="-mt-2 text-xs text-slate-500">점수 변화는 첫 실습 → 최근 실습이에요. 자주 쓴 말은 한 수강생이 2번 이상 반복한 말이에요.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-y border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">수강생</th>
                    <th className="px-3 py-2 text-right font-medium">실습</th>
                    <th className="px-3 py-2 text-right font-medium">평균 점수</th>
                    <th className="px-3 py-2 text-right font-medium">점수 변화</th>
                    <th className="px-3 py-2 text-right font-medium">쿠션어</th>
                    <th className="px-3 py-2 text-right font-medium">공감</th>
                    <th className="px-3 py-2 text-right font-medium">말버릇</th>
                    <th className="px-3 py-2 text-right font-medium">금지 표현</th>
                    <th className="px-5 py-2 font-medium">자주 쓴 말</th>
                  </tr>
                </thead>
                <tbody>
                  {a.learnerRows.map((r) => (
                    <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2">
                        <Link href={`/instructor/cohorts/${id}/learners/${r.userId}`} className="font-medium text-brand-600 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sessions}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.avgScore)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.change == null ? "-" : <Delta from={0} to={r.change} />}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.cushion, "%")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.empathy, "%")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(r.filler, "%")}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.forbidden > 0 ? "font-semibold text-rose-700" : ""}`}>
                        {r.analyzed ? `${r.forbidden}회` : "-"}
                      </td>
                      <td className="max-w-[14rem] truncate px-5 py-2 text-slate-600">{r.topPhrase ? `“${r.topPhrase}”` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ⑧ 수강생 구성 */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="경력">
              <CountList rows={a.makeup.career} total={s.enrolled} />
            </Section>
            <Section title="직무">
              <CountList rows={a.makeup.job} total={s.enrolled} />
            </Section>
            <Section title="입장 방법">
              <CountList rows={a.makeup.entry} total={s.enrolled} />
            </Section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
