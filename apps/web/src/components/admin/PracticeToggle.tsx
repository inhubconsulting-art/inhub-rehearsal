"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 목록의 '개인 연습' 켜기·끄기 스위치. 켜면 수강생 '연습하기'에 이 시나리오가 보입니다(게시됨일 때만).
 * 언제: 관리자 → 시나리오 목록.
 * 리뷰 포인트: 초안·보관 상태면 켜 두어도 연습하기에 보이지 않는다는 안내를 함께 보여 줍니다.
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useToast } from "@/components/Toast";

export function PracticeToggle({ scenarioId, initial, published }: { scenarioId: string; initial: boolean; published: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  async function toggle() {
    const next = !on;
    setBusy(true);
    const res = await fetch(`/api/scenarios/${scenarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practicePublic: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
      return showToast(msg ?? "바꾸지 못했습니다.", "error");
    }
    setOn(next);
    showToast(next ? (published ? "연습하기에 공개했어요" : "켰어요. 게시하면 연습하기에 보여요") : "연습하기에서 숨겼어요");
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="개인 연습에 공개"
        disabled={busy}
        onClick={toggle}
        className={clsx("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand-500" : "bg-slate-300", busy && "opacity-60")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      {on && !published && <span className="text-xs text-amber-700">게시 후 보임</span>}
      {toast}
    </span>
  );
}
