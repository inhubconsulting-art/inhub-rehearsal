/**
 * ===== 쉬운 설명 =====
 * 무엇: 서버에서 '로그인한 사용자 본인 권한'으로 DB에 접속하는 연결 도구.
 * 언제: 서버 화면이 현재 로그인 사용자를 확인할 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** 로그인한 사용자 권한(RLS)으로 동작하는 서버용 클라이언트 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없음 — 미들웨어가 갱신하므로 무시
        }
      },
    },
  });
}
