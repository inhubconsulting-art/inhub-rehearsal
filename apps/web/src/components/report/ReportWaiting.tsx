"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 'AI 코치가 분석하고 있어요' 대기 화면. 평가가 완료되면 자동으로 리포트로 바뀝니다.
 * 언제: 대화 종료 직후.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { uniqueTopic } from "@/lib/realtime";

/** 평가 생성 대기 화면: 평가가 저장되거나 세션 상태가 바뀌면 새로고침 (PRD L-30) */
export function ReportWaiting({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const supabase = browserClient();
    const ch = supabase
      .channel(uniqueTopic(`report:${sessionId}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "evaluations", filter: `session_id=eq.${sessionId}` }, () =>
        router.refresh(),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    // 실시간 연결이 끊긴 경우를 대비한 주기적 새로고침
    const poll = setInterval(() => router.refresh(), 10000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
      clearInterval(poll);
    };
  }, [sessionId, router]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
      <p className="text-lg font-semibold">AI 코치가 대화를 분석하고 있어요</p>
      <p className="mt-1 text-sm text-slate-500">
        보통 1분 안에 끝납니다 · {elapsed}초 경과
      </p>
    </div>
  );
}
