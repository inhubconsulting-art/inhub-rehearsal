"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 코멘트·점수 보정 입력 양식.
 * 언제: 강사용 대화 상세(종료 후).
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Field, Input, Textarea } from "@/components/ui";

export function NoteForm({ evaluationId, currentScore }: { evaluationId: string; currentScore: number }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/evaluations/${evaluationId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || null, scoreOverride: score === "" ? null : Number(score) }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error);
    setComment("");
    setScore("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="코멘트" hint="수강생 리포트에 표시됩니다.">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
      </Field>
      <Field label="점수 보정 (선택)" hint={`AI 점수 ${Math.round(currentScore)}점. 비우면 유지`}>
        <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={busy}>
        저장
      </Button>
    </form>
  );
}
