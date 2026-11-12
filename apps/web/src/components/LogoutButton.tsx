"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그아웃 버튼.
 * 언제: 상단 메뉴.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      로그아웃
    </button>
  );
}
