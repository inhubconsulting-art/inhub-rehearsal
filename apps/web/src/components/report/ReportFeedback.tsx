"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생에게 짧게 묻는 두 가지.
 *  ① RealismRating  : "실제 고객과 얼마나 비슷했나요?" 1~5점 (시나리오 품질 개선용)
 *  ② ReportFeedback : 리포트 끝의 "이 평가에 동의하나요?" 👍/👎 (+ 👎이면 한 줄 의견, 선택) — AI 평가 신뢰도 확인용
 * 언제: ① 리포트를 기다리는 동안과, 아직 답하지 않았다면 리포트 끝에서 ② 리포트 끝에서.
 * 리뷰 포인트: 답하지 않아도 아무 불이익이 없고, 다시 누르면 답을 바꿀 수 있습니다(마지막 답을 씀).
 * =====================
 */
import { useState } from "react";
import clsx from "clsx";
import { Button, Card, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { track } from "@/lib/track";

const REALISM_LABELS = ["전혀 아니에요", "별로요", "보통이에요", "비슷했어요", "실제 같았어요"];

export function RealismRating({ sessionId, initial, compact }: { sessionId: string; initial: number | null; compact?: boolean }) {
  const [score, setScore] = useState<number | null>(initial);
  const [toast, showToast] = useToast();

  async function pick(n: number) {
    setScore(n);
    const ok = await track({ type: "realism_rating", sessionId, props: { score: n } });
    if (ok) showToast("의견 고마워요! 시나리오를 다듬는 데 쓸게요");
    else showToast("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요", "error");
  }

  return (
    <div className={clsx(compact ? "" : "rounded-xl border border-slate-200 bg-white p-5")}>
      <p className="text-sm font-semibold text-slate-800">방금 대화한 AI 고객, 실제 고객과 얼마나 비슷했나요?</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="현실감 점수">
        {REALISM_LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              onClick={() => void pick(n)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-sm",
                score === n ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              <span className="mr-1 font-semibold tabular-nums">{n}</span>
              {label}
            </button>
          );
        })}
      </div>
      {toast}
    </div>
  );
}

export function ReportFeedback({
  sessionId,
  initialAgree,
  initialRealism,
}: {
  sessionId: string;
  initialAgree: boolean | null;
  initialRealism: number | null;
}) {
  const [agree, setAgree] = useState<boolean | null>(initialAgree);
  const [comment, setComment] = useState("");
  const [sentComment, setSentComment] = useState(false);
  const [toast, showToast] = useToast();

  async function send(a: boolean, c: string | null) {
    const ok = await track({ type: "report_feedback", sessionId, props: { agree: a, comment: c } });
    if (ok) showToast(c ? "의견을 보냈어요. 고마워요!" : "고마워요! 평가를 다듬는 데 쓸게요");
    else showToast("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요", "error");
    return ok;
  }

  return (
    <Card className="no-print">
      <p className="text-sm font-semibold text-slate-800">이 AI 평가에 동의하나요?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { v: true, label: "👍 동의해요" },
          { v: false, label: "👎 다르게 생각해요" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={agree === o.v}
            onClick={() => {
              setAgree(o.v);
              setSentComment(false);
              void send(o.v, null);
            }}
            className={clsx(
              "rounded-lg border px-4 py-2 text-sm",
              agree === o.v ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {agree === false && !sentComment && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="어떤 부분이 다르다고 느꼈나요? (선택)"
            aria-label="평가에 대한 의견"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={!comment.trim()}
              onClick={async () => {
                if (await send(false, comment.trim())) setSentComment(true);
              }}
            >
              의견 보내기
            </Button>
          </div>
        </div>
      )}
      {initialRealism == null && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <RealismRating sessionId={sessionId} initial={null} compact />
        </div>
      )}
      {toast}
    </Card>
  );
}
