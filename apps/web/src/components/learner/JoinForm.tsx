"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 입장 코드 입력 + 개인정보·대화 저장 동의 체크박스.
 * 언제: 수강생 첫 화면.
 * 리뷰 포인트: 입장 전에 '내 정보'(소속·직무·경력)를 보여 주고, 바뀌었으면 고치고 들어오도록 안내합니다.
 *         동의 문구가 의사결정(전사 텍스트만 저장, 녹음 원본 미저장)과 맞는지 확인하세요.
 * =====================
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input } from "@/components/ui";

export function JoinForm({
  initialCode = "",
  entrySource,
  profileSummary,
}: {
  initialCode?: string;
  /** QR·공유 주소로 들어와 코드가 채워진 경우 그 경로 (qr / link) */
  entrySource?: "qr" | "link";
  profileSummary?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 채워진 코드를 그대로 쓰면 QR·주소로 들어온 것, 코드를 바꿔 입력했으면 직접 입력('code')으로 기록
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        consent,
        source: entrySource && code.trim().toUpperCase() === initialCode.trim().toUpperCase() ? entrySource : "code",
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    router.push(`/learn?cohort=${json.cohortId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="입장 코드 6자리"
          maxLength={12}
          className="max-w-48 font-mono text-lg tracking-widest uppercase"
          required
        />
        <Button type="submit" disabled={busy || !consent}>
          참여하기
        </Button>
      </div>
      {profileSummary && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">내 정보</span> {profileSummary}
          <span className="ml-2 text-xs text-slate-400">바뀌었다면</span>{" "}
          <Link href="/account#profile" className="text-xs text-brand-600 underline">
            먼저 고치기
          </Link>
        </p>
      )}
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          실습 대화 내용(텍스트, 음성은 자막으로 변환된 텍스트)이 저장되고 AI 평가 및 강사 피드백에 사용되는 것에
          동의합니다. 음성 녹음 원본은 저장하지 않습니다.{" "}
          <Link href="/privacy" target="_blank" className="text-brand-600 underline">
            자세히 보기
          </Link>
        </span>
      </label>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
