"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 접속 기록. 브라우저 탭을 열어 서비스에 들어올 때 한 번만 '접속'을 기록합니다(새로고침·화면 이동은 세지 않음).
 *      주소에 ?src=qr / ?src=link 가 있으면 QR·공유 주소로 들어왔다고 함께 남깁니다.
 * 언제: 로그인한 화면(상단 메뉴가 있는 모든 화면)에 들어올 때.
 * 리뷰 포인트: 화면에는 아무것도 그리지 않습니다.
 * =====================
 */
import { useEffect } from "react";
import { track } from "@/lib/track";

const KEY = "inhub_visit_logged";

export function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // 저장소를 쓸 수 없는 환경(일부 인앱 브라우저)은 기록하지 않음
    }
    const url = new URL(window.location.href);
    const src = url.searchParams.get("src");
    let referrer: string | null = null;
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host !== url.host) referrer = r.host;
    } catch {}
    void track({
      type: "visit",
      props: { path: url.pathname, src: src === "qr" || src === "link" ? src : null, referrer },
    });
  }, []);
  return null;
}
