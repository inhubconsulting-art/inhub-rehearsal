"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 대시보드를 실시간으로 유지합니다: 대화·평가가 바뀌면 자동 새로고침, 수강생 접속 여부 추적.
 * 언제: 강사 대시보드에 보이지 않게 들어 있습니다.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";

export type PresenceInfo = {
  userId: string;
  name: string;
  activity: string;
};

/** 차수 데이터 변경 시 화면 새로고침 + 수강생 접속(presence) 추적 */
export function useCohortRealtime(cohortId: string) {
  const router = useRouter();
  const [online, setOnline] = useState<Map<string, PresenceInfo>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 800);
    };
    const ch = supabase
      .channel(`dash:${cohortId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `cohort_id=eq.${cohortId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments", filter: `cohort_id=eq.${cohortId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_summaries", filter: `cohort_id=eq.${cohortId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "evaluations" }, refresh)
      .subscribe();

    const presence = supabase.channel(`cohort-presence:${cohortId}`);
    const sync = () => {
      const state = presence.presenceState<PresenceInfo>();
      const m = new Map<string, PresenceInfo>();
      for (const [key, metas] of Object.entries(state)) {
        const last = metas[metas.length - 1];
        if (last) m.set(key, { userId: key, name: last.name, activity: last.activity });
      }
      setOnline(m);
    };
    presence.on("presence", { event: "sync" }, sync).subscribe();

    // 오래 켜둔 화면도 '정체' 판단이 맞도록 1분마다 새로고침
    const poll = setInterval(() => router.refresh(), 60000);
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(presence);
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cohortId, router]);

  return { online };
}
