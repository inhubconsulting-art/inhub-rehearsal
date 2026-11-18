/**
 * ===== 쉬운 설명 =====
 * 무엇: 실습 대화 분석 결과를 계산해 DB에 저장하는 곳. 계산 규칙은 packages/shared/src/analytics.ts 에 있습니다.
 *  ① analyzeSession  : 실습 1회 분석 → session_analytics(요약 숫자), utterance_analytics(문장별 표시) 저장
 *  ② analyzePending  : 아직 분석하지 않았거나, 규칙·표현 목록이 바뀌어 다시 분석해야 하는 지난 실습을 조금씩 처리
 * 언제: ① 실습 평가가 끝난 직후 ② 상시 서버가 켜질 때와 2분마다.
 * 리뷰 포인트:
 *  - 분석은 '덤'입니다. 실패해도 평가·리포트에는 영향을 주지 않고 로그만 남깁니다.
 *  - DB 표가 아직 없으면(마이그레이션 전) 조용히 건너뜁니다.
 * =====================
 */
import {
  analyzeConversation,
  ANALYZER_VERSION,
  LEXICON_CATEGORIES,
  lexiconHash,
  type Lexicon,
  type SessionRow,
  type VoiceSegment,
} from "@inhub/shared";
import { db, getMessages } from "./clients";

let lexCache: { lex: Lexicon; hash: string; at: number } | null = null;

/** 표현 목록 읽기 (1분간 기억) */
async function loadLexicon() {
  if (lexCache && Date.now() - lexCache.at < 60_000) return lexCache;
  const { data, error } = await db.from("phrase_lexicon").select("category, phrase").eq("active", true);
  if (error) throw error;
  const lex = Object.fromEntries(LEXICON_CATEGORIES.map((c) => [c, [] as string[]])) as Lexicon;
  for (const r of (data ?? []) as { category: keyof Lexicon; phrase: string }[]) lex[r.category]?.push(r.phrase);
  lexCache = { lex, hash: lexiconHash(lex), at: Date.now() };
  return lexCache;
}

/** 실습 1회 분석 후 저장 */
export async function analyzeSession(sessionId: string) {
  const { data: s } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!s) return;
  const session = s as SessionRow;
  if (session.status === "active") return;

  const [{ lex, hash }, messages, voice] = await Promise.all([
    loadLexicon(),
    getMessages(sessionId),
    db.from("learner_events").select("props").eq("session_id", sessionId).eq("type", "voice_segments"),
  ]);
  // 음성 통화가 여러 번 다시 연결됐으면 연결마다 기록된 구간을 모두 합침
  const segments: VoiceSegment[] = ((voice.data ?? []) as { props: { segments?: VoiceSegment[] } }[]).flatMap((r) => r.props.segments ?? []);

  const { session: a, utterances } = analyzeConversation({
    messages: messages.map((m) => ({ id: m.id, seq: m.seq, role: m.role, content: m.content, created_at: m.created_at })),
    mode: session.mode,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    lexicon: lex,
    voiceSegments: segments,
  });

  const { error } = await db.from("session_analytics").upsert(
    {
      session_id: session.id,
      user_id: session.user_id,
      cohort_id: session.cohort_id,
      mode: session.mode,
      ...a,
      analyzer_version: ANALYZER_VERSION,
      lexicon_hash: hash,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "session_id" },
  );
  if (error) throw error;

  // 문장별 결과는 지우고 새로 씀 (재분석 시 이전 결과가 남지 않게)
  await db.from("utterance_analytics").delete().eq("session_id", session.id);
  if (utterances.length) {
    const { error: e2 } = await db
      .from("utterance_analytics")
      .insert(utterances.map((u) => ({ ...u, session_id: session.id, user_id: session.user_id })));
    if (e2) throw e2;
  }
}

/** 평가가 끝난 뒤 호출: 실패해도 로그만 */
export async function analyzeSessionSafe(sessionId: string) {
  try {
    await analyzeSession(sessionId);
  } catch (e) {
    console.warn(`[analytics] ${sessionId.slice(0, 8)} 분석 건너뜀:`, (e as { message?: string })?.message ?? e);
  }
}

let busy = false;

/**
 * 분석이 없거나 오래된(규칙 버전·표현 목록이 바뀐) 지난 실습을 최대 limit 개 처리.
 * 최근에 끝난 실습부터 500개씩 훑습니다.
 */
export async function analyzePending(limit = 30) {
  if (busy) return;
  busy = true;
  try {
    const { hash } = await loadLexicon();
    const pending: string[] = [];
    for (let from = 0; pending.length < limit; from += 500) {
      const { data: ss, error } = await db
        .from("sessions")
        .select("id")
        .in("status", ["evaluated", "failed"])
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .range(from, from + 499);
      if (error) throw error;
      const ids = ((ss ?? []) as { id: string }[]).map((r) => r.id);
      if (!ids.length) break;
      const { data: done, error: e2 } = await db
        .from("session_analytics")
        .select("session_id, analyzer_version, lexicon_hash")
        .in("session_id", ids);
      if (e2) throw e2;
      const ok = new Set(
        ((done ?? []) as { session_id: string; analyzer_version: number; lexicon_hash: string }[])
          .filter((d) => d.analyzer_version >= ANALYZER_VERSION && d.lexicon_hash === hash)
          .map((d) => d.session_id),
      );
      for (const id of ids) if (!ok.has(id) && pending.length < limit) pending.push(id);
      if (ids.length < 500) break;
    }
    for (const id of pending) await analyzeSessionSafe(id);
    if (pending.length) console.log(`[analytics] 지난 실습 ${pending.length}개 분석`);
  } catch (e) {
    // 표가 아직 없는 경우(마이그레이션 전) 등: 다음에 다시 시도
    console.warn("[analytics] 일괄 분석 건너뜀:", (e as { message?: string })?.message ?? e);
  } finally {
    busy = false;
  }
}
