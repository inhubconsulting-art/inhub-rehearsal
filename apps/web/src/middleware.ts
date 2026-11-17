/**
 * ===== 쉬운 설명 =====
 * 무엇: 모든 화면 요청 앞에서 '로그인했는가'를 확인하는 문지기입니다.
 * 언제: 사용자가 어떤 주소로 들어오든 매번.
 * 리뷰 포인트: 로그인하지 않은 사용자가 로그인 화면으로 보내지는지만 확인하면 됩니다.
 *         이용약관(/terms)·개인정보처리방침(/privacy)은 Google 심사와 법령상 누구나 볼 수 있어야 해서 예외로 둡니다.
 *         수강생이 프로필(소속·직무·경력)을 아직 채우지 않았으면 '프로필 완성'(/onboarding) 화면으로 먼저 보냅니다.
 *         한 번 확인되면 쿠키에 기록해 두어, 매 화면마다 DB를 다시 묻지 않습니다.
 * =====================
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/terms"];
/** 프로필 완성 확인이 끝난 사용자 id 를 담아 두는 쿠키 */
const PROFILE_OK_COOKIE = "inhub_profile_ok";

/** 로그인 세션 쿠키 갱신 + 미로그인 사용자를 로그인 화면으로 보냄 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!user && !isPublic && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // 쉬운 설명: 로그인한 수강생이 프로필을 아직 안 채웠으면 '프로필 완성' 화면으로 보냅니다.
  if (user && !isPublic && !path.startsWith("/api/") && !path.startsWith("/onboarding")) {
    if (request.cookies.get(PROFILE_OK_COOKIE)?.value !== user.id) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, profile_completed_at")
        .eq("id", user.id)
        .maybeSingle();
      // DB 칸이 아직 없거나(마이그레이션 전) 조회에 실패하면 막지 않고 그냥 통과시킵니다.
      // 이유는 터미널(로컬)·Vercel 로그에 남겨 둡니다. 화면 쪽(requirePageUser)에서 한 번 더 확인합니다.
      if (error) console.warn("[프로필 확인 실패] 안내 없이 통과:", error.message);
      if (!error && profile) {
        const p = profile as { role: string; profile_completed_at: string | null };
        if (p.role === "learner" && !p.profile_completed_at) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          url.search = "";
          url.searchParams.set("next", path + request.nextUrl.search);
          const redirect = NextResponse.redirect(url);
          // 방금 갱신된 로그인 쿠키를 이동하는 응답에도 그대로 실어 보냅니다.
          response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
          return redirect;
        }
        response.cookies.set(PROFILE_OK_COOKIE, user.id, {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
