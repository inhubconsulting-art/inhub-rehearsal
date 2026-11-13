/**
 * ===== 쉬운 설명 =====
 * 무엇: 날짜·시간을 '한국 시간'으로 표시하는 공통 함수입니다.
 * 왜: 화면을 만드는 Vercel 서버의 시계는 세계 표준시(UTC)라서, 시간대를 지정하지 않으면
 *     오후 2시가 오전 5시처럼 9시간 일찍 보입니다. 날짜를 화면에 쓸 때는 항상 이 함수를 쓰세요.
 * =====================
 */
const TZ = "Asia/Seoul";

type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 예) 2026. 11. 13. 오후 2:05 */
export function fmtDateTime(v: DateInput): string {
  const d = toDate(v);
  if (!d) return "-";
  return d.toLocaleString("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** 예) 2026. 11. 13. */
export function fmtDate(v: DateInput): string {
  const d = toDate(v);
  if (!d) return "-";
  return d.toLocaleDateString("ko-KR", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" });
}
