/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 분석 엔진. 실습 대화 전문을 받아 ① 수강생 발화 문장마다 쿠션어·사과·공감·금지 표현·필러를 찾아 표시하고
 *      ② 실습 1회의 숫자 지표(응답 시간, 발화 길이, 말 비율, 표현 사용률, 음성 말 속도 등)를 계산합니다.
 *      AI를 쓰지 않고 정해진 규칙으로만 계산하므로 비용이 들지 않고, 같은 대화는 언제 다시 돌려도 같은 결과가 나옵니다.
 * 언제: 상시 서버가 실습 평가를 마친 직후, 그리고 지난 실습을 한꺼번에 다시 분석할 때.
 * 리뷰 포인트:
 *  - 필러: '음·어·아'는 혼자 쓰이면 셉니다. '그·저·일단' 등은 뒤에 쉼표·말줄임표가 오거나 반복할 때만 셉니다.
 *    ('그 부분은', '저는', '일단 확인해 보겠습니다' 같은 정상 문장은 세지 않음)
 *  - 나머지 표현은 띄어쓰기를 무시하고 찾습니다. ('안 됩니다' = '안됩니다')
 *  - 응답 시간은 텍스트 모드에서만 계산합니다. 음성은 자막 변환 시간이 섞여 정확하지 않아 대신 말한 시간·말 속도를 씁니다.
 *  - 계산 규칙을 바꾸면 ANALYZER_VERSION 을 1 올리세요. 상시 서버가 지난 실습을 새 규칙으로 자동 재분석합니다.
 * =====================
 */

export const ANALYZER_VERSION = 1;

export const LEXICON_CATEGORIES = ["cushion", "apology", "empathy", "forbidden", "filler"] as const;
export type LexiconCategory = (typeof LEXICON_CATEGORIES)[number];
export const LEXICON_CATEGORY_LABELS: Record<LexiconCategory, string> = {
  cushion: "쿠션어",
  apology: "사과",
  empathy: "공감 표현",
  forbidden: "금지 표현",
  filler: "필러(말버릇 소리)",
};

export type Lexicon = Record<LexiconCategory, string[]>;

/** 표현 목록이 바뀌었는지 알아보기 위한 짧은 지문 (목록이 바뀌면 지난 실습을 다시 분석) */
export function lexiconHash(lex: Lexicon): string {
  const text = LEXICON_CATEGORIES.map((c) => `${c}:${[...new Set(lex[c])].sort().join("|")}`).join("\n");
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export interface AnalyzerMessage {
  id: string;
  seq: number;
  role: "learner" | "customer";
  content: string;
  created_at: string;
}

/** 음성 통화에서 수강생이 말한 구간 (상시 서버가 기록, 밀리초) */
export interface VoiceSegment {
  start_ms: number;
  end_ms: number;
  /** AI 고객이 말하는 도중에 시작한 말인지 (끼어들기) */
  during_ai: boolean;
}

export interface UtteranceAnalysis {
  message_id: string;
  seq: number;
  chars: number;
  sentence_count: number;
  latency_sec: number | null;
  fillers: string[];
  cushions: string[];
  apologies: string[];
  empathies: string[];
  forbidden: string[];
  is_question: boolean;
  last_phrase: string | null;
}

export interface SessionAnalysis {
  duration_sec: number | null;
  learner_turns: number;
  customer_turns: number;
  avg_latency_sec: number | null;
  median_latency_sec: number | null;
  max_latency_sec: number | null;
  avg_learner_chars: number | null;
  talk_ratio: number | null;
  filler_count: number;
  cushion_count: number;
  apology_count: number;
  empathy_count: number;
  forbidden_count: number;
  filler_rate: number | null;
  cushion_rate: number | null;
  apology_rate: number | null;
  empathy_rate: number | null;
  forbidden_rate: number | null;
  question_rate: number | null;
  speaking_sec: number | null;
  chars_per_sec: number | null;
  speech_segments: number | null;
  interruptions: number | null;
  phrase_counts: Partial<Record<LexiconCategory, Record<string, number>>>;
  top_ngrams: [string, number][];
}

const PUNCT = /[.,!?…~·"'“”‘’()\[\]]/g;
const noSpace = (s: string) => s.replace(/\s+/g, "");
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const charCount = (s: string) => noSpace(s.replace(PUNCT, "")).length;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 문장 나누기: 마침표·물음표·느낌표·말줄임표 뒤에서 자름 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 띄어쓰기를 무시하고 phrase 가 몇 번 나오는지 */
function countContains(textNoSpace: string, phrase: string): number {
  const p = noSpace(phrase);
  if (!p) return 0;
  let n = 0;
  for (let i = textNoSpace.indexOf(p); i !== -1; i = textNoSpace.indexOf(p, i + p.length)) n++;
  return n;
}

/**
 * 필러 세기: 단어가 혼자 쓰였을 때만 (앞은 문장 시작·공백·문장부호, 뒤는 쉼표·말줄임표·문장 끝·같은 말 반복).
 * '음'·'어'·'아'는 '음음', '어어어'처럼 늘인 것도 셈.
 */
function countFiller(text: string, filler: string): number {
  const interjection = /^[음어아]$/.test(filler);
  const word = interjection ? `${escapeRe(filler)}+` : escapeRe(filler);
  // '음·어·아'는 혼자 쓰이면 언제나 필러, 나머지('그', '저', '일단' 등)는 뒤에 쉼표·말줄임표가 오거나 같은 말을 반복할 때만
  const after = interjection ? `(?=[\\s,.!?…~]|$)` : `(?=\\s*(?:,|…|\\.{2,}|~|$)|\\s+${word}(?:[\\s,]|$))`;
  const re = new RegExp(`(?:^|[\\s,.!?…~])(${word})${after}`, "g");
  return [...text.matchAll(re)].length;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 말버릇 찾기용 어절 묶음(2~3어절). 문장 경계를 넘지 않음 */
function ngrams(sentence: string): string[] {
  const w = sentence.replace(PUNCT, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const n of [2, 3]) for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" "));
  return out;
}

export function analyzeConversation(input: {
  messages: AnalyzerMessage[];
  mode: "text" | "voice";
  startedAt: string;
  endedAt: string | null;
  lexicon: Lexicon;
  voiceSegments?: VoiceSegment[] | null;
}): { session: SessionAnalysis; utterances: UtteranceAnalysis[] } {
  const msgs = [...input.messages].sort((a, b) => a.seq - b.seq);
  const lex = input.lexicon;
  // 같은 뜻(띄어쓰기만 다른) 표현은 하나로
  const uniq = (list: string[]) => [...new Map(list.map((p) => [noSpace(p), p])).values()];
  const lists = Object.fromEntries(LEXICON_CATEGORIES.map((c) => [c, uniq(lex[c] ?? [])])) as Lexicon;
  // 필러를 뺀 모든 표현을 긴 것부터 (예: '죄송합니다만'을 '죄송합니다'보다 먼저)
  const phraseOrder = (["cushion", "apology", "empathy", "forbidden"] as const)
    .flatMap((c) => lists[c].map((p) => ({ c, p })))
    .sort((a, b) => noSpace(b.p).length - noSpace(a.p).length);

  const phraseCounts: SessionAnalysis["phrase_counts"] = {};
  const bump = (c: LexiconCategory, p: string, n: number) => {
    const m = (phraseCounts[c] ??= {});
    m[p] = (m[p] ?? 0) + n;
  };

  const utterances: UtteranceAnalysis[] = [];
  let prevCustomerAt: number | null = null;
  let learnerChars = 0;
  let customerChars = 0;
  const gramCounts = new Map<string, number>();

  for (const m of msgs) {
    const chars = charCount(m.content);
    if (m.role === "customer") {
      customerChars += chars;
      prevCustomerAt = new Date(m.created_at).getTime();
      continue;
    }
    learnerChars += chars;
    const found: Record<LexiconCategory, string[]> = { cushion: [], apology: [], empathy: [], forbidden: [], filler: [] };

    // 모든 분류를 통틀어 긴 표현부터 찾고, 찾은 부분은 지움 → '죄송합니다만'(쿠션어)이 '죄송합니다'(사과)로 또 세지지 않음
    let rest = noSpace(m.content);
    for (const { c, p } of phraseOrder) {
      const n = countContains(rest, p);
      if (!n) continue;
      found[c].push(...Array(n).fill(p));
      bump(c, p, n);
      rest = rest.split(noSpace(p)).join("|");
    }
    for (const p of lists.filler) {
      const n = countFiller(m.content, p);
      if (!n) continue;
      found.filler.push(...Array(n).fill(p));
      bump("filler", p, n);
    }

    const sentences = splitSentences(m.content);
    for (const s of sentences) for (const g of new Set(ngrams(s))) gramCounts.set(g, (gramCounts.get(g) ?? 0) + 1);
    const last = sentences.at(-1)?.replace(PUNCT, " ").split(/\s+/).filter(Boolean).slice(-2).join(" ") || null;

    const at = new Date(m.created_at).getTime();
    const latency = input.mode === "text" && prevCustomerAt != null ? round((at - prevCustomerAt) / 1000) : null;
    prevCustomerAt = null; // 고객 말 하나에 첫 대답만 응답 시간으로 셈

    utterances.push({
      message_id: m.id,
      seq: m.seq,
      chars,
      sentence_count: sentences.length,
      latency_sec: latency != null && latency >= 0 ? latency : null,
      fillers: found.filler,
      cushions: found.cushion,
      apologies: found.apology,
      empathies: found.empathy,
      forbidden: found.forbidden,
      is_question: /\?\s*$/.test(m.content.trim()) || /(까요|나요|습니까|세요)\?/.test(m.content),
      last_phrase: last,
    });
  }

  const n = utterances.length;
  const rate = (k: keyof Pick<UtteranceAnalysis, "fillers" | "cushions" | "apologies" | "empathies" | "forbidden">) =>
    n ? round((utterances.filter((u) => u[k].length > 0).length / n) * 100) : null;
  const total = (k: keyof Pick<UtteranceAnalysis, "fillers" | "cushions" | "apologies" | "empathies" | "forbidden">) =>
    utterances.reduce((a, u) => a + u[k].length, 0);
  const lat = utterances.map((u) => u.latency_sec).filter((x): x is number => x != null);

  // 음성: 수강생이 실제로 말한 시간과 말 속도
  const segs = input.mode === "voice" ? (input.voiceSegments ?? []).filter((s) => s.end_ms > s.start_ms) : [];
  const speakingSec = segs.length ? round(segs.reduce((a, s) => a + (s.end_ms - s.start_ms), 0) / 1000) : null;

  const start = new Date(input.startedAt).getTime();
  const end = input.endedAt ? new Date(input.endedAt).getTime() : null;

  return {
    utterances,
    session: {
      duration_sec: end != null ? Math.max(0, Math.round((end - start) / 1000)) : null,
      learner_turns: n,
      customer_turns: msgs.filter((m) => m.role === "customer").length,
      avg_latency_sec: lat.length ? round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
      median_latency_sec: lat.length ? round(median(lat)!) : null,
      max_latency_sec: lat.length ? Math.max(...lat) : null,
      avg_learner_chars: n ? round(learnerChars / n) : null,
      talk_ratio: learnerChars + customerChars ? round(learnerChars / (learnerChars + customerChars), 2) : null,
      filler_count: total("fillers"),
      cushion_count: total("cushions"),
      apology_count: total("apologies"),
      empathy_count: total("empathies"),
      forbidden_count: total("forbidden"),
      filler_rate: rate("fillers"),
      cushion_rate: rate("cushions"),
      apology_rate: rate("apologies"),
      empathy_rate: rate("empathies"),
      forbidden_rate: rate("forbidden"),
      question_rate: n ? round((utterances.filter((u) => u.is_question).length / n) * 100) : null,
      speaking_sec: speakingSec,
      chars_per_sec: speakingSec ? round(learnerChars / speakingSec) : null,
      speech_segments: input.mode === "voice" ? segs.length : null,
      interruptions: input.mode === "voice" ? segs.filter((s) => s.during_ai).length : null,
      phrase_counts: phraseCounts,
      // 2번 이상 쓴 말 묶음만, 많은 순 40개 (사람별 말버릇은 분석 화면에서 다른 수강생과 비교해 골라냄)
      top_ngrams: [...gramCounts.entries()]
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40),
    },
  };
}

/** 행동 기록 종류 (learner_events.type) */
export const EVENT_TYPES = {
  /** 서비스 접속 (브라우저 탭마다 한 번) */
  visit: "visit",
  /** 로그인 (email / google) */
  login: "login",
  /** 리포트를 보고 나감: 머문 시간, 가장 아래까지 내려간 비율 */
  report_view: "report_view",
  /** 리포트의 접힌 부분(대화 전문 등)을 펼침 */
  report_section_open: "report_section_open",
  /** AI 평가에 동의하는지 (👍/👎) */
  report_feedback: "report_feedback",
  /** 실습 직후 '실제 고객과 얼마나 비슷했나요?' (1~5) */
  realism_rating: "realism_rating",
  /** 음성 통화 1회 연결 동안 수강생이 말한 구간들 (상시 서버가 기록) */
  voice_segments: "voice_segments",
} as const;
export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
