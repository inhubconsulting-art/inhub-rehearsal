"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 비밀번호 재설정 메일의 링크를 누르면 오는 화면. 새 비밀번호를 정합니다.
 * 언제: 로그인 화면 '비밀번호를 잊으셨나요?' → 메일 링크 클릭 후.
 * 리뷰 포인트: 링크가 만료됐으면 로그인 화면으로 돌려보내 다시 요청하게 합니다.
 * =====================
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    browserClient()
      .auth.getUser()
      .then(({ data }) => setReady(data.user ? "ok" : "no"))
      .catch(() => setReady("no"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    if (pw !== pw2) return setError("두 비밀번호가 서로 다릅니다.");
    setBusy(true);
    const supabase = browserClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return setError(/different|same/i.test(error.message) ? "이전과 다른 비밀번호를 입력해 주세요." : "비밀번호를 바꾸지 못했습니다. 다시 시도해 주세요.");
    }
    await supabase.auth.signOut();
    router.replace("/login?notice=password");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold">새 비밀번호 정하기</h1>
        {ready === "checking" && <p className="mt-3 text-sm text-slate-500">확인 중…</p>}
        {ready === "no" && (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-slate-600">링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.</p>
            <Button className="w-full" onClick={() => router.replace("/login")}>
              로그인 화면으로
            </Button>
          </div>
        )}
        {ready === "ok" && (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <Field label="새 비밀번호" hint="8자 이상">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Field label="새 비밀번호 확인">
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "저장 중…" : "비밀번호 바꾸기"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
