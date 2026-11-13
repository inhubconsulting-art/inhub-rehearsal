/**
 * ===== 쉬운 설명 =====
 * 무엇: 토큰 사용량으로 API 비용을 '추정'합니다. 단가표가 여기 있습니다.
 * 언제: 관리자 사용량 화면.
 * 리뷰 포인트: 단가는 2026년 10월 공개 자료 기준 추정치입니다. 실제 OpenAI 가격과 다르면 환경변수 PRICE_* 로 바꾸세요.
 * =====================
 */
/**
 * 비용 추정 (USD). 단가는 100만 토큰당 가격이며 환경변수로 덮어쓸 수 있다.
 * 기본값은 2026-10 공개 자료 기준 추정치이므로 OpenAI 가격 페이지로 확인 후 조정할 것.
 */
const num = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};

export const PRICES = {
  // Realtime (기본: gpt-realtime-2.1-mini)
  rtAudioIn: num("PRICE_RT_AUDIO_IN", 10),
  rtAudioCached: num("PRICE_RT_AUDIO_CACHED", 0.3),
  rtAudioOut: num("PRICE_RT_AUDIO_OUT", 20),
  rtTextIn: num("PRICE_RT_TEXT_IN", 0.6),
  rtTextOut: num("PRICE_RT_TEXT_OUT", 2.4),
  // 텍스트 대화·감정 판단·평가 모델
  textIn: num("PRICE_TEXT_IN", 0.25),
  textOut: num("PRICE_TEXT_OUT", 2),
  // 음성 대화 중 수강생 말 전사 (기본: gpt-4o-mini-transcribe)
  trAudioIn: num("PRICE_TR_AUDIO_IN", 3),
  trTextIn: num("PRICE_TR_TEXT_IN", 1.25),
  trOut: num("PRICE_TR_OUT", 5),
  // 전사 사용량이 '초' 단위로만 올 때 쓰는 분당 가격 (USD/분)
  trPerMinute: num("PRICE_TR_PER_MIN", 0.003),
};

export function estimateCost(u: Record<string, number>): number {
  const m = (k: string) => (u[k] ?? 0) / 1_000_000;
  return (
    m("rt_audio_input_tokens") * PRICES.rtAudioIn +
    m("rt_cached_input_tokens") * PRICES.rtAudioCached +
    m("rt_audio_output_tokens") * PRICES.rtAudioOut +
    m("rt_text_input_tokens") * PRICES.rtTextIn +
    m("rt_text_output_tokens") * PRICES.rtTextOut +
    m("text_input_tokens") * PRICES.textIn +
    m("text_output_tokens") * PRICES.textOut +
    m("tr_audio_input_tokens") * PRICES.trAudioIn +
    m("tr_text_input_tokens") * PRICES.trTextIn +
    m("tr_output_tokens") * PRICES.trOut +
    ((u["tr_seconds"] ?? 0) / 60) * PRICES.trPerMinute
  );
}
