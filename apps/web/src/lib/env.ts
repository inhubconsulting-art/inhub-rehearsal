/**
 * ===== 쉬운 설명 =====
 * 무엇: 서버 비밀값(API 키 등)과 사용할 AI 모델 이름을 환경변수에서 읽습니다.
 * 언제: 서버 기능이 OpenAI·Supabase에 접속할 때.
 * 리뷰 포인트: 모델 기본값(gpt-realtime-2.1-mini, gpt-5-mini)이 의사결정과 맞는지 확인하세요. 값은 .env 에서
 *         바꿉니다.
 * =====================
 */
/** 서버 전용 환경변수. 누락 시 어떤 값이 없는지 명확히 알려준다. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env.example 을 참고하세요.`);
  return v;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get openaiKey() {
    return required("OPENAI_API_KEY");
  },
  get realtimeModel() {
    return process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
  },
  get transcribeModel() {
    return process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  },
  get chatModel() {
    return process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
  },
  get classifierModel() {
    return process.env.OPENAI_CLASSIFIER_MODEL || "gpt-5-mini";
  },
  get workerUrl() {
    return process.env.WORKER_URL || "http://localhost:8787";
  },
  get workerSecret() {
    return required("WORKER_SHARED_SECRET");
  },
};

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
