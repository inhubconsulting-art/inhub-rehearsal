/**
 * ===== 쉬운 설명 =====
 * 무엇: 이메일 인증 링크를 누르고 돌아왔을 때 로그인을 마무리하는 주소.
 * 언제: Supabase에서 이메일 인증을 켰을 때만.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 이메일 인증·소셜 로그인 후 돌아오는 주소 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
