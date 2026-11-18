/**
 * ===== 쉬운 설명 =====
 * 무엇: 브라우저에서 행동 기록을 서버(/api/events)로 보내는 함수.
 * 언제: 접속, 로그인, 리포트 열람, 버튼 클릭 때.
 * 리뷰 포인트: 기록이 실패해도 화면에는 아무 영향이 없게 오류를 삼킵니다.
 *         페이지를 떠나는 순간에도 전송되도록 sendBeacon(→ 안 되면 keepalive fetch)을 씁니다.
 * =====================
 */
export function track(body: { type: string; sessionId?: string; props?: Record<string, unknown> }, opts?: { leaving?: boolean }) {
  try {
    const json = JSON.stringify(body);
    if (opts?.leaving && typeof navigator !== "undefined" && navigator.sendBeacon) {
      if (navigator.sendBeacon("/api/events", new Blob([json], { type: "text/plain" }))) return Promise.resolve(true);
    }
    return fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true })
      .then((r) => r.ok)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
