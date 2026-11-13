"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인·회원가입·비밀번호 찾기 화면. 가입 시 이름과 소속(선택)을 받습니다.
 * 언제: 처음 접속하거나 로그아웃 상태일 때.
 * 리뷰 포인트:
 *  - 가입 이메일은 형식 검사를 하고, 흔한 오타(gmial.com 등)는 고친 주소를 제안합니다.
 *  - 가입 직전에 "이 이메일이 맞나요?" 확인을 한 번 더 받습니다 (오타 가입 방지).
 *  - 비밀번호 찾기: 이메일로 재설정 링크를 보내고, 링크를 누르면 /auth/reset-password 에서 새 비밀번호를 정합니다.
 * =====================
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { isValidEmail, suggestEmailFix } from "@/lib/email";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

type Mode = "login" | "signup" | "reset";

const NOTICE: Record<string, string> = {
  deleted: "회원 탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.",
  password: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.",
  expired: "링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const notice = NOTICE[params.get("notice") ?? ""] ?? null;
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);

  const emailTrim = email.trim();
  const emailFix = mode === "signup" ? suggestEmailFix(emailTrim) : null;
  const emailInvalid = emailTrim.length > 0 && !isValidEmail(emailTrim);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setInfo(null);
    setConfirming(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!isValidEmail(emailTrim)) {
      setError("이메일 형식으로 입력해 주세요. 예) hong@company.com");
      return;
    }
    // 쉬운 설명: 가입은 한 번 더 확인 단계를 거칩니다 (이메일 오타 가입 방지).
    if (mode === "signup" && !confirming) {
      if (!name.trim()) return setError("이름을 입력해 주세요.");
      if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
      setConfirming(true);
      return;
    }

    setBusy(true);
    const supabase = browserClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: emailTrim, password });
        if (error) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(emailTrim, {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
        });
        if (error) {
          throw new Error(
            /rate|limit|seconds/i.test(error.message)
              ? "메일 발송 요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요."
              : "메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
          );
        }
        // 가입 여부를 알려 주지 않도록 항상 같은 안내를 보여 줍니다.
        setInfo("입력한 이메일로 비밀번호 재설정 링크를 보냈습니다. 메일이 안 보이면 스팸함도 확인해 주세요. 링크는 이 브라우저에서 열어 주세요.");
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailTrim,
          password,
          options: {
            data: { name: name.trim(), organization: organization.trim() || null },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) {
          throw new Error(
            error.message.includes("registered")
              ? "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요."
              : /email/i.test(error.message) || /database error/i.test(error.message)
                ? "이메일 형식이 올바르지 않습니다."
                : error.message,
          );
        }
        if (!data.session) {
          setConfirming(false);
          setInfo("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
          return;
        }
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = busy
    ? "처리 중…"
    : mode === "login"
      ? "로그인"
      : mode === "reset"
        ? "재설정 링크 받기"
        : confirming
          ? "네, 이 이메일로 가입합니다"
          : "가입하고 시작하기";

  return (
    <Card className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-2xl font-bold text-brand-600">인허브 리허설</div>
        <p className="mt-1 text-sm text-slate-500">AI 고객과 함께하는 CS 응대 실습</p>
      </div>
      {mode === "reset" ? (
        <div className="mb-5">
          <h2 className="font-semibold">비밀번호 찾기</h2>
          <p className="mt-1 text-sm text-slate-500">가입한 이메일을 입력하면 비밀번호를 새로 정할 수 있는 링크를 보내 드려요.</p>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white shadow-sm" : "text-slate-500"}`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "signup" && (
          <>
            <Field label="이름">
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" disabled={confirming} />
            </Field>
            <Field label="소속 (선택)">
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} disabled={confirming} />
            </Field>
          </>
        )}
        <Field label="이메일" hint={mode === "signup" ? "로그인 아이디로 쓰입니다. 이메일 형식만 가능해요." : undefined}>
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value.replace(/\s/g, ""));
              setConfirming(false);
            }}
            placeholder="hong@company.com"
            required
            autoComplete="email"
            aria-invalid={emailInvalid}
            className={emailInvalid ? "border-rose-400" : undefined}
          />
        </Field>
        {emailInvalid && <p className="-mt-2 text-xs text-rose-600">이메일 형식이 아니에요. 예) hong@company.com</p>}
        {emailFix && (
          <p className="-mt-2 text-xs text-amber-700">
            혹시{" "}
            <button type="button" className="font-semibold underline" onClick={() => setEmail(emailFix)}>
              {emailFix}
            </button>{" "}
            인가요?
          </p>
        )}
        {mode !== "reset" && (
          <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pr-16"
                disabled={confirming}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs text-slate-500 hover:bg-slate-100"
              >
                {showPw ? "숨기기" : "보기"}
              </button>
            </div>
          </Field>
        )}

        {confirming && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
            <p className="text-amber-900">
              <span className="font-semibold">{emailTrim}</span>
              <br />이 이메일이 맞나요? 가입 후에는 직접 바꿀 수 없어요.
            </p>
            <button type="button" className="mt-2 text-xs font-medium text-amber-800 underline" onClick={() => setConfirming(false)}>
              이메일 다시 고치기
            </button>
          </div>
        )}

        <ErrorText>{error}</ErrorText>
        {info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{info}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {submitLabel}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        {mode === "reset" ? (
          <button type="button" className="text-slate-500 hover:underline" onClick={() => switchMode("login")}>
            ← 로그인으로 돌아가기
          </button>
        ) : mode === "login" ? (
          <button type="button" className="text-slate-500 hover:underline" onClick={() => switchMode("reset")}>
            비밀번호를 잊으셨나요?
          </button>
        ) : null}
      </div>
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
