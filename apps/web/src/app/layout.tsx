/**
 * ===== 쉬운 설명 =====
 * 무엇: 모든 화면을 감싸는 틀(글꼴, 제목).
 * 언제: 모든 화면.
 * 리뷰 포인트: 브라우저 탭 제목 '인허브 리허설'을 바꾸려면 여기.
 * =====================
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인허브 리허설",
  description: "AI 고객과 함께하는 CS 응대 실습",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
