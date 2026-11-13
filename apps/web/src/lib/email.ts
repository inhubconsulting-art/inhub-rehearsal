/**
 * ===== 쉬운 설명 =====
 * 무엇: 가입할 때 '이메일 형식'인지 검사하고, 흔한 오타(gmial.com 등)를 찾아 알려 줍니다.
 * 리뷰 포인트: 서버(DB)에서도 같은 기준으로 한 번 더 막습니다 (supabase/migrations/20261113000000_account_and_cohort.sql).
 * =====================
 */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

const COMMON_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.con": "gmail.com",
  "naver.co": "naver.com",
  "naver.con": "naver.com",
  "nvaer.com": "naver.com",
  "daum.ne": "daum.net",
  "daum.com": "daum.net",
  "hanmail.com": "hanmail.net",
  "hanmial.net": "hanmail.net",
  "kakao.co": "kakao.com",
};

/** 오타로 보이면 고친 주소를, 아니면 null 을 돌려줍니다. */
export function suggestEmailFix(v: string): string | null {
  const [local, domain] = v.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  const fixed = COMMON_TYPOS[domain];
  return fixed ? `${local}@${fixed}` : null;
}
