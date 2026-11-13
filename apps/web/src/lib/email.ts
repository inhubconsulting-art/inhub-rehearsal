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

/**
 * 오타를 찾을 '자주 쓰는 메일 주소' 목록. 많이 쓰는 순서대로 적습니다(비슷하면 앞쪽을 제안).
 * 우리 교육에 자주 오는 회사 메일 주소가 있으면 여기에 추가하면 그 주소의 오타도 잡습니다.
 */
const POPULAR = [
  "gmail.com",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  "nate.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com",
];

/**
 * 오타처럼 보이지만 '실제로 있는' 메일 주소. 여기 있으면 제안하지 않습니다.
 * (예: mail.com 은 gmail.com 과 한 글자 차이지만 진짜 메일 서비스)
 */
const REAL_LOOKALIKES = new Set([
  "mail.com",
  "gmx.com",
  "gmx.net",
  "live.com",
  "msn.com",
  "me.com",
  "mac.com",
  "yahoo.co.kr",
  "hanmir.com",
  "korea.com",
  "empas.com",
  "chol.com",
  "dreamwiz.com",
  "paran.com",
  "hitel.net",
  "cloud.com",
  "outlook.kr",
  "hotmail.co.kr",
  "live.co.kr",
]);

/** 두 글자열이 '몇 번 고치면 같아지는지'(바꾸기·넣기·빼기·옆 글자 뒤바꾸기 각 1회). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * 오타로 보이면 고친 주소를, 아니면 null 을 돌려줍니다.
 * 규칙: ① 이름(@ 뒤 첫 부분)이 자주 쓰는 메일과 같은데 끝부분(.com/.net 등)이 다르면 그 메일로 제안.
 *       ② 자주 쓰는 메일 주소와 비교해 짧은 주소(8자 이하)는 1글자, 긴 주소는 2글자 이내로 다르면 오타로 봅니다.
 * 제안만 할 뿐 막지는 않습니다(실제로 있는 회사 메일 주소일 수 있으므로).
 */
export function suggestEmailFix(v: string): string | null {
  const [local, domain] = v.trim().toLowerCase().split("@");
  if (!local || !domain || !domain.includes(".")) return null;
  if (POPULAR.includes(domain) || REAL_LOOKALIKES.has(domain)) return null;
  // 1) 이름은 맞고 끝부분만 틀린 경우 (예: hanmail.com → hanmail.net, gmail.co.kr → gmail.com)
  const name = domain.split(".")[0];
  const sameName = POPULAR.find((p) => p.split(".")[0] === name);
  if (sameName) return `${local}@${sameName}`;
  // 2) 글자 몇 개가 틀린 경우 (예: naaver.com → naver.com)
  let best: { d: string; dist: number } | null = null;
  for (const p of POPULAR) {
    const dist = editDistance(domain, p);
    const limit = p.length <= 8 ? 1 : 2;
    if (dist <= limit && (!best || dist < best.dist)) best = { d: p, dist };
  }
  return best ? `${local}@${best.d}` : null;
}
