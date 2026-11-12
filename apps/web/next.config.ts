/**
 * ===== 쉬운 설명 =====
 * 무엇: 웹앱(Next.js) 설정.
 * 언제: 웹앱을 빌드·실행할 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@inhub/shared"],
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
