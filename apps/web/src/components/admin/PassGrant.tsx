"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 사용자 목록의 '이용권' 칸. 남은 횟수를 보여 주고, 횟수를 적어 지급(+) 또는 회수(−)합니다.
 * 언제: 관리자 → 사용자·이용권.
 * 리뷰 포인트: 회수는 앞에 −를 붙여 적습니다(예: -2). 성공·실패는 알림으로 보여 줍니다.
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function PassGrant({ userId, balance }: { userId: string; balance: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState("3");
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  async function grant() {
    const delta = Number(value);
    if (!Number.isInteger(delta) || delta === 0) return showToast("지급할 횟수를 정수로 적어 주세요 (회수는 -2처럼)", "error");
    setBusy(true);
    const res = await fetch(`/api/users/${userId}/passes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note: null }),
    }).catch(() => null);
    setBusy(false);
    const json = res ? ((await res.json().catch(() => ({}))) as { error?: string; balance?: number }) : {};
    if (!res?.ok) return showToast(json.error ?? "처리하지 못했습니다.", "error");
    showToast(delta > 0 ? `${delta}회 지급했어요 (남은 ${json.balance}회)` : `${-delta}회 회수했어요 (남은 ${json.balance}회)`);
    router.refresh();
  }

  if (balance === null) return <span className="text-xs text-slate-400">DB 준비 전</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-10 text-right font-semibold tabular-nums">{balance}회</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-16 rounded-md border border-slate-300 px-2 text-sm"
        aria-label="지급할 횟수 (회수는 음수)"
        min={-100}
        max={100}
      />
      <button
        type="button"
        onClick={grant}
        disabled={busy}
        className="h-8 rounded-md border border-slate-300 px-2.5 text-sm hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? "…" : "지급"}
      </button>
      {toast}
    </span>
  );
}
