/**
 * ===== 쉬운 설명 =====
 * 무엇: 상시 서버의 비밀값과 설정(모델, 동시 처리 수)을 읽습니다.
 * 언제: 상시 서버 시작 시.
 * 리뷰 포인트: EVAL_CONCURRENCY(동시에 만들 리포트 수, 기본 4)가 이 파일에 있습니다.
 * =====================
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[worker] 환경변수 ${name} 가 없습니다. .env.example 을 참고하세요.`);
    process.exit(1);
  }
  return v;
}

export const env = {
  port: Number(process.env.PORT || 8787),
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiKey: required("OPENAI_API_KEY"),
  sharedSecret: required("WORKER_SHARED_SECRET"),
  classifierModel: process.env.OPENAI_CLASSIFIER_MODEL || "gpt-5-mini",
  evalModel: process.env.OPENAI_EVAL_MODEL || "gpt-5-mini",
  reasoningEffort: (process.env.OPENAI_REASONING_EFFORT || undefined) as "minimal" | "low" | "medium" | "high" | undefined,
  evalConcurrency: Math.max(1, Number(process.env.EVAL_CONCURRENCY || 4)),
};
