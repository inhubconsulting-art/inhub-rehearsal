/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트 본문. 등급·점수, 역량별 점수, 필수 절차 체크리스트, 고객 감정 흐름, 잘한 점, 개선할 점(대체 문장 포함),
 *     다음 연습 추천, 강사 코멘트, 대화 전문 순서로 보여줍니다.
 * 언제: 수강생 리포트, 강사의 대화 상세, 일괄 인쇄.
 * 리뷰 포인트: PRD 6.2 리포트 구성 7가지와 순서·문구가 맞는지 확인하세요. 수강생에게 점수까지 공개하기로 한 결정이 반영되어
 *         있습니다.
 * =====================
 */
import Link from "next/link";
import {
  COMPETENCY_LABELS,
  END_REASON_LABELS,
  emotionLabel,
  type EndReason,
} from "@inhub/shared";
import { effectiveScore, type ReportData } from "@/lib/report";
import { Badge, Card, CardTitle } from "@/components/ui";
import { CompetencyRadar, EmotionFlow } from "./Charts";
import { fmtDateTime } from "@/lib/format";

const GRADE_TONE = { S: "violet", A: "blue", B: "green", C: "amber", D: "rose" } as const;

export function ReportView({ r, staffView, anonymize }: { r: ReportData; staffView?: boolean; anonymize?: boolean }) {
  const ev = r.evaluation!;
  const res = ev.result;
  const score = effectiveScore(r) ?? 0;
  const bySeq = new Map(r.messages.map((m) => [m.seq, m]));
  const duration = r.session.ended_at
    ? Math.round((new Date(r.session.ended_at).getTime() - new Date(r.session.started_at).getTime()) / 1000)
    : null;
  const emotionData = r.messages
    .filter((m) => m.role === "customer" && m.emotion != null)
    .map((m) => ({ seq: m.seq, emotion: m.emotion! }));
  const turning = new Set(res.emotionTurningPoints.map((t) => t.messageSeq));
  // 쉬운 설명: 강사가 점수를 보정했으면 '(강사 보정)'을 표시합니다.
  const overridden = r.notes.some((n) => n.score_override != null);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <div className={`text-5xl font-black ${score >= 80 ? "text-brand-600" : score >= 60 ? "text-amber-600" : "text-rose-600"}`}>
              {res.grade}
            </div>
            <div className="mt-1 text-sm tabular-nums text-slate-500">
              {Math.round(score)}점{overridden && " (강사 보정)"}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Badge tone={GRADE_TONE[res.grade]}>{r.content.title}</Badge>
              <Badge>{r.session.mode === "voice" ? "음성" : "텍스트"}</Badge>
              {r.session.end_reason && <Badge>{END_REASON_LABELS[r.session.end_reason as EndReason] ?? r.session.end_reason}</Badge>}
              {duration != null && <Badge>{Math.floor(duration / 60)}분 {duration % 60}초</Badge>}
              <Badge>최고 감정 {emotionLabel(r.session.peak_emotion)}</Badge>
            </div>
            <p className="text-lg font-semibold leading-snug">{res.oneLineSummary}</p>
            {!anonymize && staffView && <p className="mt-1 text-sm text-slate-500">수강생: {r.learnerName}</p>}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle>역량별 점수</CardTitle>
          <CompetencyRadar data={res.competencyScores.map((c) => ({ label: COMPETENCY_LABELS[c.competency], score: Math.round(c.score) }))} />
          <ul className="mt-2 space-y-1.5 text-sm">
            {res.competencyScores.map((c) => (
              <li key={c.competency} className="flex gap-2">
                <span className="w-28 shrink-0 font-medium">{COMPETENCY_LABELS[c.competency]}</span>
                <span className="w-10 shrink-0 tabular-nums text-slate-500">{Math.round(c.score)}</span>
                <span className="text-slate-600">{c.comment}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>필수 절차 체크리스트</CardTitle>
          <ul className="space-y-2 text-sm">
            {res.checklist.map((c) => (
              <li key={c.stepId} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${c.done ? "bg-emerald-500" : "bg-rose-400"}`}>
                  {c.done ? "✓" : "✕"}
                </span>
                <span>
                  {c.label}
                  {c.evidenceSeq != null && <span className="ml-1 text-xs text-slate-400">#{c.evidenceSeq}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <CardTitle>고객 감정 흐름</CardTitle>
            <EmotionFlow data={emotionData} />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>잘한 점</CardTitle>
        <div className="space-y-3">
          {res.goodPoints.map((p, i) => (
            <div key={i} className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/60 px-4 py-3">
              <p className="text-sm text-slate-500">#{p.messageSeq} &ldquo;{bySeq.get(p.messageSeq)?.content ?? p.quote}&rdquo;</p>
              <p className="mt-1">{p.reason}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>개선할 점</CardTitle>
        <div className="space-y-3">
          {res.improvements.map((p, i) => (
            <div key={i} className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 px-4 py-3">
              <p className="text-sm text-slate-500">#{p.messageSeq} &ldquo;{bySeq.get(p.messageSeq)?.content ?? p.quote}&rdquo;</p>
              <p className="mt-1">{p.problem}</p>
              <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm">
                <span className="font-semibold text-brand-600">이렇게 말해 보세요 · </span>
                {p.betterExample}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>다음 연습 추천</CardTitle>
        <p>
          <span className="font-semibold">{COMPETENCY_LABELS[res.recommendation.competency]}</span> — {res.recommendation.reason}
        </p>
        {r.nextScenario && !staffView && (
          <p className="mt-2 text-sm">
            추천 시나리오:{" "}
            <Link className="font-medium text-brand-600 underline" href={`/learn/${r.cohort.id}/scenarios/${r.nextScenario.id}`}>
              {r.nextScenario.title}
            </Link>
          </p>
        )}
      </Card>

      {r.notes.length > 0 && (
        <Card>
          <CardTitle>강사 코멘트</CardTitle>
          <div className="space-y-2">
            {r.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-violet-50 px-4 py-3 text-sm">
                <div className="mb-1 text-xs text-violet-700">
                  {n.author_name} · {fmtDateTime(n.created_at)}
                  {n.score_override != null && ` · 점수 ${n.score_override}점으로 보정`}
                </div>
                {n.comment}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <details>
          <summary className="cursor-pointer font-semibold">대화 전문 ({r.messages.length}개 발화)</summary>
          <div className="mt-4 space-y-2 text-sm">
            {r.messages.map((m) => (
              <div key={m.seq} className={`flex gap-3 rounded-md px-2 py-1 ${turning.has(m.seq) ? "bg-amber-50" : ""}`}>
                <span className="w-8 shrink-0 text-right text-xs text-slate-400">#{m.seq}</span>
                <span className={`w-14 shrink-0 font-medium ${m.role === "learner" ? "text-brand-600" : "text-slate-500"}`}>
                  {m.role === "learner" ? (anonymize ? "상담원" : "나") : "고객"}
                </span>
                <span className="flex-1">{m.content}</span>
                {m.role === "customer" && m.emotion != null && <span className="shrink-0 text-xs text-slate-400">{emotionLabel(m.emotion)}</span>}
              </div>
            ))}
          </div>
        </details>
      </Card>
    </div>
  );
}
