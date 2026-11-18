"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인·회원가입·비밀번호 찾기 화면. 가입 시 이름·이메일·비밀번호만 받고,
 *      소속·업종·직무·경력은 가입 직후 '프로필 완성' 화면(/onboarding)에서 받습니다(Google 가입자와 같은 흐름).
 * 언제: 처음 접속하거나 로그아웃 상태일 때.
 * 리뷰 포인트:
 *  - 가입 이메일은 형식 검사를 하고, 흔한 오타(gmial.com 등)는 고친 주소를 제안합니다.
 *  - 가입 직전에 "이 이메일이 맞나요?" 확인을 한 번 더 받습니다 (오타 가입 방지).
 *  - 비밀번호 찾기: 이메일로 재설정 링크를 보내고, 링크를 누르면 /auth/reset-password 에서 새 비밀번호를 정합니다.
 *  - 가입(이메일·Google 모두) 시 이용약관·개인정보처리방침 링크와 '만 14세 이상' 안내를 보여 줍니다.
 *  - 'Google로 계속하기': 구글 계정으로 가입·로그인을 한 번에 합니다. 처음이면 자동으로 수강생 계정이 만들어지고,
 *    같은 이메일로 이미 가입한 계정이 있으면 그 계정으로 로그인됩니다(Supabase가 자동 연결).
 * =====================
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { isValidEmail, suggestEmailFix } from "@/lib/email";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

type Mode = "login" | "signup" | "reset";

const NOTICE: Record<string, string> = {
  deleted: "회원 탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.",
  password: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.",
  expired: "링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
  failed: "로그인을 마치지 못했습니다. 다시 시도해 주세요. 메일 링크였다면 만료됐거나 다른 브라우저에서 열었을 수 있어요.",
};

/** 구글 'G' 로고 (공식 4색) */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);

  const emailTrim = email.trim();
  const emailFix = mode === "signup" ? suggestEmailFix(emailTrim) : null;
  const emailInvalid = emailTrim.length > 0 && !isValidEmail(emailTrim);

  /** 쉬운 설명: 구글 로그인 화면으로 보냈다가, 끝나면 /auth/callback 으로 돌아와 원래 가려던 화면(next)으로 갑니다. */
  async function googleLogin() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error } = await browserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        // via=google: 돌아왔을 때 'Google 로그인' 기록을 남기기 위한 표시
        redirectTo: `${window.location.origin}/auth/callback?via=google&next=${encodeURIComponent(next)}`,
        // 여러 구글 계정을 쓰는 사람도 매번 계정을 고를 수 있게 합니다 (공용 PC 실습실 대비).
        queryParams: { prompt: "select_account" },
      },
    });
    // 성공하면 구글 화면으로 이동하므로, 여기까지 오는 건 실패했을 때뿐입니다.
    if (error) {
      setBusy(false);
      setError("Google 로그인을 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
  }

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
            data: { name: name.trim() },
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
      // 쉬운 설명: 로그인(또는 가입 직후 자동 로그인) 기록 — 실패해도 이동에는 영향 없음
      void track({ type: "login", props: { method: "email" } });
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
      {mode !== "reset" && (
        <>
          <Button type="button" variant="secondary" size="lg" className="flex w-full items-center justify-center gap-2" onClick={googleLogin} disabled={busy}>
            <GoogleIcon />
            Google로 계속하기
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            또는 이메일로 {mode === "login" ? "로그인" : "가입"}
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "signup" && (
          <>
            <Field label="이름">
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" disabled={confirming} />
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
        ) : (
          <>
            {mode === "login" && (
              <button type="button" className="mb-3 text-slate-500 hover:underline" onClick={() => switchMode("reset")}>
                비밀번호를 잊으셨나요?
              </button>
            )}
            <AgreeNotice action={mode === "signup" ? "가입하거나 Google로 계속하면" : "Google로 처음 계속하면"} />
          </>
        )}
      </div>
      <div className="mt-6 flex justify-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400">
        <Link href="/terms" className="hover:underline">
          이용약관
        </Link>
        <Link href="/privacy" className="font-semibold text-slate-500 hover:underline">
          개인정보처리방침
        </Link>
      </div>
    </Card>
  );
}

/** 쉬운 설명: 가입 전에 약관·방침을 볼 수 있게 링크와 함께 안내하는 문구 */
function AgreeNotice({ action }: { action: string }) {
  return (
    <p className="text-xs leading-5 text-slate-500">
      {action}{" "}
      <Link href="/terms" target="_blank" className="underline">
        이용약관
      </Link>
      과{" "}
      <Link href="/privacy" target="_blank" className="underline">
        개인정보처리방침
      </Link>
      (AI 처리를 위한 해외 업체 위탁 포함)에 동의하게 됩니다. 만 14세 이상만 가입할 수 있어요.
    </p>
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
