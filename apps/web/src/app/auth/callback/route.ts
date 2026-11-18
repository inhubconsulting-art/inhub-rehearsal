/**
 * ===== 쉬운 설명 =====
 * 무엇: 이메일 인증 링크·비밀번호 재설정 링크·Google 로그인을 마치고 돌아왔을 때 로그인을 마무리하는 주소.
 * 언제: 메일 링크를 눌렀을 때, Google 계정 선택을 마쳤을 때.
 * 리뷰 포인트: Google 로그인으로 돌아오면 로그인 기록을 남깁니다.
 *         Google 화면에서 '취소'하거나 오류가 나면 로그인 화면에 안내 문구를 띄웁니다.
 * =====================
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EVENT_TYPES } from "@inhub/shared";
import { parseUserAgent, recordEvent } from "@/lib/events";

/** 이메일 인증·소셜 로그인 후 돌아오는 주소 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const isReset = next.startsWith("/auth/reset-password");
  // 쉬운 설명: Google 화면에서 취소했거나 메일 링크가 만료되면 ?error=... 로 돌아옵니다.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?notice=${isReset ? "expired" : "failed"}`);
  }
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // 쉬운 설명: 링크가 만료됐거나 다른 브라우저에서 열어 확인에 실패하면 로그인 화면에서 안내합니다.
    if (error) {
      // 비밀번호 재설정 링크였으면 '재설정 링크 만료', 그 밖(가입 확인 메일·Google 로그인)은 일반 안내
      const notice = isReset ? "expired" : "failed";
      return NextResponse.redirect(`${origin}/login?notice=${notice}`);
    }
    // 쉬운 설명: Google 로그인이었으면 '로그인' 기록을 남깁니다(기기 정보 포함). 실패해도 로그인에는 영향 없음.
    if (searchParams.get("via") === "google" && data.user) {
      await recordEvent({
        userId: data.user.id,
        type: EVENT_TYPES.login,
        props: { method: "google", ...parseUserAgent(request.headers.get("user-agent")) },
      });
    }
  }
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
