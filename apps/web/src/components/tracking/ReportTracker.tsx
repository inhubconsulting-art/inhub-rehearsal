"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트 열람 기록. 수강생이 리포트를 실제로 보고 있던 시간(다른 탭에 가 있던 시간은 뺌)과
 *      화면을 어디까지 내려 봤는지(%)를 재서, 리포트를 떠나거나 다른 탭으로 갈 때 저장합니다.
 *      '대화 전문'처럼 접힌 부분을 펼치면 그것도 기록합니다.
 * 언제: 수강생 본인의 리포트 화면에서만 (강사 화면에서는 기록하지 않음).
 * 리뷰 포인트: 화면에는 아무것도 그리지 않습니다. 다른 탭에 갔다가 돌아오면 그 뒤의 시간만 새로 이어서 셉니다.
 * =====================
 */
import { useEffect } from "react";
import { track } from "@/lib/track";

export function ReportTracker({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let dwellMs = 0;
    let maxScroll = 0;

    const measureScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const pct = total <= 0 ? 100 : Math.round((window.scrollY / total) * 100);
      maxScroll = Math.max(maxScroll, Math.min(100, pct));
    };
    // 보낸 뒤에는 0부터 다시 셈 (여러 번 보내면 분석할 때 더함)
    const flush = () => {
      if (visibleSince != null) {
        dwellMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      if (dwellMs < 1000) return;
      void track(
        { type: "report_view", sessionId, props: { dwell_sec: Math.round(dwellMs / 1000), max_scroll_pct: maxScroll } },
        { leaving: true },
      );
      dwellMs = 0;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else visibleSince = Date.now();
    };
    const onToggle = (e: Event) => {
      const el = e.target as HTMLDetailsElement;
      const section = el?.dataset?.track;
      if (el?.open && section === "transcript") void track({ type: "report_section_open", sessionId, props: { section } });
    };

    measureScroll();
    window.addEventListener("scroll", measureScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      flush(); // 화면 안에서 다른 페이지로 이동할 때
      window.removeEventListener("scroll", measureScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, [sessionId]);
  return null;
}
