"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 브라우저에서 DB에 접속하는 연결 도구. 본인에게 허용된 행만 보이고, 실시간 알림을 받을 때 씁니다.
 * 언제: 수강생·강사 화면이 실시간 변경을 구독할 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** 브라우저용 클라이언트 (RLS 적용, 실시간 구독용) */
export function browserClient() {
  if (!cached) {
    cached = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cached;
}
