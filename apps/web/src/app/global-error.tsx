"use client";
import Link from "next/link";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 화면 틀(맨 바깥 레이아웃)까지 오류가 났을 때의 최후 안내 화면입니다. 거의 쓰일 일이 없습니다.
 * =====================
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>화면을 불러오는 중 문제가 생겼어요</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>잠시 후 다시 시도해 주세요.</p>
          <button onClick={() => reset()} style={{ marginTop: 16, padding: "8px 16px" }}>
            다시 시도
          </button>{" "}
          <Link href="/" style={{ marginLeft: 8 }}>
            처음 화면으로
          </Link>
        </div>
      </body>
    </html>
  );
}
