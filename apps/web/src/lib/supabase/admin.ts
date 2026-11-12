/**
 * ===== 쉬운 설명 =====
 * 무엇: 서버에서 '관리자 열쇠(service role)'로 DB에 접속하는 연결 도구. 모든 행을 읽고 쓸 수 있으므로 권한 확인
 *     후에만 씁니다.
 * 언제: API가 권한을 확인한 뒤 DB에 기록할 때.
 * 리뷰 포인트: 이 파일 자체보다, 이 도구를 쓰는 곳마다 앞에서 권한 확인(requireApiUser 등)을 하는지가 중요합니다.
 * =====================
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let cached: ReturnType<typeof createClient> | null = null;

/** service_role 권한 클라이언트 (RLS 우회). 반드시 권한 확인 후 서버에서만 사용. */
export function adminClient() {
  if (!cached) {
    cached = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
