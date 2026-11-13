"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 화면의 '강사 코멘트' 목록. 내가 쓴 코멘트는 수정·삭제할 수 있습니다(관리자는 모두).
 * 언제: 강사용 대화 상세 화면(리포트 아래).
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { Button, Card, CardTitle, ErrorText, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

export type StaffNote = {
  id: string;
  author_id: string | null;
  author_name: string;
  comment: string | null;
  score_override: number | null;
  created_at: string;
  updated_at: string | null;
};

export function StaffNotes({ notes, userId, isAdmin }: { notes: StaffNote[]; userId: string; isAdmin: boolean }) {
  const [toast, showToast] = useToast();
  if (notes.length === 0) return null;
  return (
    <Card>
      <CardTitle>강사 코멘트</CardTitle>
      <div className="space-y-2">
        {notes.map((n) => (
          <NoteItem key={n.id} n={n} canEdit={isAdmin || n.author_id === userId} onDone={showToast} />
        ))}
      </div>
      {toast}
    </Card>
  );
}

function NoteItem({ n, canEdit, onDone }: { n: StaffNote; canEdit: boolean; onDone: (m: string, tone?: "success" | "error") => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(n.comment ?? "");
  const [score, setScore] = useState(n.score_override != null ? String(n.score_override) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || null, scoreOverride: score === "" ? null : Number(score) }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "저장하지 못했습니다.");
    setEditing(false);
    onDone("코멘트를 수정했습니다");
    router.refresh();
  }

  async function remove() {
    if (!confirm("이 코멘트를 삭제할까요? 수강생 리포트에서도 사라지고, 점수 보정이 있었다면 함께 취소됩니다.")) return;
    setBusy(true);
    const res = await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return onDone((await res.json().catch(() => ({}))).error ?? "삭제하지 못했습니다.", "error");
    onDone("코멘트를 삭제했습니다");
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-violet-200 bg-white px-4 py-3 text-sm">
        <Field label="코멘트">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </Field>
        <Field label="점수 보정 (선택)" hint="비우면 보정 없음">
          <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className="max-w-32" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setComment(n.comment ?? "");
              setScore(n.score_override != null ? String(n.score_override) : "");
              setError(null);
            }}
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-violet-50 px-4 py-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-violet-700">
        <span>
          {n.author_name} · {fmtDateTime(n.created_at)}
          {n.updated_at && " (수정됨)"}
          {n.score_override != null && ` · 점수 ${n.score_override}점으로 보정`}
        </span>
        {canEdit && (
          <span className="ml-auto flex gap-1">
            <button className="rounded px-1.5 py-0.5 hover:bg-violet-100" onClick={() => setEditing(true)} disabled={busy}>
              수정
            </button>
            <button className="rounded px-1.5 py-0.5 text-rose-600 hover:bg-rose-50" onClick={remove} disabled={busy}>
              삭제
            </button>
          </span>
        )}
      </div>
      {n.comment}
    </div>
  );
}
