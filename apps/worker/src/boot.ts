/**
 * ===== 쉬운 설명 =====
 * 무엇: 상시 서버의 시작 버튼. 환경변수 파일을 읽은 뒤 서버를 켭니다.
 * 언제: 상시 서버를 실행할 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { existsSync } from "node:fs";

// 로컬 개발: apps/worker/.env 또는 루트 .env 를 읽는다 (배포 환경에서는 플랫폼 환경변수 사용)
for (const p of [".env", "../../.env"]) {
  if (existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}

await import("./server");
