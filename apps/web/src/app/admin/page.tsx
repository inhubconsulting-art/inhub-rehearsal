/**
 * ===== 쉬운 설명 =====
 * 무엇: '/admin' 주소로 오면 시나리오 목록으로 보냅니다.
 * 언제: -
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/scenarios");
}
