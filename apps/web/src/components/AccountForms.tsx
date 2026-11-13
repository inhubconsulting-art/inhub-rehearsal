"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 계정' 화면의 비밀번호 변경 칸과 회원 탈퇴 칸.
 * 리뷰 포인트: 탈퇴는 '탈퇴'라고 직접 입력해야 버튼이 눌립니다 (실수 방지).
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { Button, Card, CardTitle, ErrorText, Field, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    if (pw !== pw2) return setError("두 비밀번호가 서로 다릅니다.");
    setBusy(true);
    const { error } = await browserClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(/different|same/i.test(error.message) ? "이전과 다른 비밀번호를 입력해 주세요." : "비밀번호를 바꾸지 못했습니다.");
    setPw("");
    setPw2("");
    showToast("비밀번호를 바꿨습니다");
  }

  return (
    <Card>
      <CardTitle>비밀번호 변경</CardTitle>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="새 비밀번호" hint="8자 이상">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="새 비밀번호 확인" hint={"\u00a0"}>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={busy || !pw} className="sm:mb-5">
          {busy ? "저장 중…" : "변경"}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {toast}
    </Card>
  );
}

export function DeleteAccount({ allowed }: { allowed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      return setError((await res.json().catch(() => ({}))).error ?? "탈퇴하지 못했습니다.");
    }
    await browserClient().auth.signOut().catch(() => {});
    router.replace("/login?notice=deleted");
    router.refresh();
  }

  return (
    <Card className="border-rose-200">
      <CardTitle>회원 탈퇴</CardTitle>
      {!allowed ? (
        <p className="text-sm text-slate-600">
          강사·관리자 계정은 교육 운영 기록과 연결되어 있어 직접 탈퇴할 수 없습니다. 다른 운영 관리자에게 요청해 주세요.
        </p>
      ) : !open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">계정과 모든 연습 기록(대화·리포트)이 삭제되며 되돌릴 수 없습니다.</p>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            탈퇴하기
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>로그인 계정과 이름·소속 정보가 삭제됩니다.</li>
            <li>참여한 교육, 모든 대화 기록과 리포트, 강사 코멘트가 함께 삭제됩니다.</li>
            <li>삭제 후에는 복구할 수 없고, 같은 이메일로 다시 가입하면 새 계정이 됩니다.</li>
          </ul>
          <Field label="계속하려면 아래 칸에 탈퇴 라고 입력하세요">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="탈퇴" className="max-w-48" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button variant="danger" disabled={typed.trim() !== "탈퇴" || busy} onClick={remove}>
              {busy ? "처리 중…" : "영구 삭제하고 탈퇴"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
            >
              취소
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
