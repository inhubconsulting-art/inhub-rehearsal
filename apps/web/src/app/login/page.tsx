"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인·회원가입 화면. 가입 시 이름과 소속(선택)을 받습니다.
 * 언제: 처음 접속하거나 로그아웃 상태일 때.
 * 리뷰 포인트: 가입 항목(이름, 소속, 이메일, 비밀번호 8자 이상)이 교육 운영에 충분한지 확인하세요.
 * =====================
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = browserClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        if (!name.trim()) throw new Error("이름을 입력해 주세요.");
        if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim(), organization: organization.trim() || null },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw new Error(error.message.includes("registered") ? "이미 가입된 이메일입니다." : error.message);
        if (!data.session) {
          setInfo("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
          return;
        }
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-2xl font-bold text-brand-600">인허브 리허설</div>
        <p className="mt-1 text-sm text-slate-500">AI 고객과 함께하는 CS 응대 실습</p>
      </div>
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            {m === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <>
            <Field label="이름">
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </Field>
            <Field label="소속 (선택)">
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="이메일">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{info}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
