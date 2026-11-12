/**
 * ===== 쉬운 설명 =====
 * 무엇: 첫 주소('/')로 들어오면 역할에 따라 수강생은 실습 화면, 강사·관리자는 강사 대시보드로 보냅니다.
 * 언제: 로그인 직후.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";

export default async function Home() {
  const u = await requirePageUser();
  redirect(u.profile.role === "learner" ? "/learn" : "/instructor");
}
