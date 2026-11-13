"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 대화 화면 본체. 위쪽에 남은 시간·브리핑·종료 버튼, 가운데 말풍선, 아래쪽에 채팅 입력창 또는 음성 통화 조작부가
 *     있습니다.
 * 언제: 대화하는 동안 내내.
 * 리뷰 포인트: 남은 1분 경고, 시간 종료 시 자동 종료, 대화가 끝나면 리포트로 이동(PRD L-25, L-30), 음성 실패 시
 *         '텍스트로 전환'(L-23)이 있는지 확인하세요.
 * =====================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationMode, LearnerScenarioView } from "@inhub/shared";
import { browserClient } from "@/lib/supabase/client";
import { Button, ErrorText, Textarea } from "@/components/ui";
import { EmotionMeter } from "@/components/EmotionMeter";
import { BriefingCard } from "./BriefingCard";
import { useVoiceCall } from "./useVoiceCall";
import { uniqueTopic } from "@/lib/realtime";

export interface ChatLine {
  seq: number;
  role: "learner" | "customer";
  content: string;
}

export function Conversation(props: {
  sessionId: string;
  mode: ConversationMode;
  allowText: boolean;
  view: LearnerScenarioView;
  initialMessages: ChatLine[];
  startedAt: string;
  timeLimitSec: number;
  initialEmotion: number;
}) {
  const { sessionId, view } = props;
  const router = useRouter();
  const [mode, setMode] = useState<ConversationMode>(props.mode);
  const [lines, setLines] = useState<ChatLine[]>(props.initialMessages);
  const [emotion, setEmotion] = useState<number>(props.initialEmotion);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(false);

  const addLine = useCallback((l: ChatLine) => {
    setLines((prev) => (prev.some((p) => p.seq === l.seq) ? prev : [...prev, l].sort((a, b) => a.seq - b.seq)));
  }, []);

  const goReport = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    router.replace(`/learn/report/${sessionId}`);
  }, [router, sessionId]);

  // 실시간: 세션 종료 감지 + (음성) 서버가 저장한 발화 수신
  useEffect(() => {
    // 쉬운 설명: 서버에서 대화가 끝났다는 알림이 오면 리포트로 이동하고, 음성 대화의 확정된 발화를 받아 화면에 추가합니다.
    const supabase = browserClient();
    const ch = supabase
      .channel(uniqueTopic(`session:${sessionId}`))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (p) => {
        const row = p.new as { status: string; current_emotion: number | null; mode: ConversationMode };
        if (row.current_emotion != null) setEmotion(row.current_emotion);
        if (row.status !== "active") goReport();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` }, (p) => {
        const m = p.new as ChatLine;
        addLine({ seq: m.seq, role: m.role, content: m.content });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, addLine, goReport]);

  // 타이머
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 쉬운 설명: 남은 시간(초) 계산. 0이 되면 아래에서 자동으로 대화를 종료합니다.
  const remaining = Math.max(0, Math.floor((new Date(props.startedAt).getTime() + props.timeLimitSec * 1000 - now) / 1000));

  const end = useCallback(
    async (reason: "learner_ended" | "time_limit" | "error") => {
      if (ending) return;
      setEnding(true);
      await fetch(`/api/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }).catch(() => {});
      goReport();
    },
    [ending, goReport, sessionId],
  );

  useEffect(() => {
    // 쉬운 설명: 시간이 다 되면 자동 종료 (PRD L-25)
    if (remaining === 0) void end("time_limit");
  }, [remaining, end]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, streaming]);

  // ───── 텍스트 모드 ─────
  // 쉬운 설명: 텍스트 모드: 메시지를 보내고, AI 답변이 글자 단위로 도착하는 대로 말풍선에 보여줍니다.
  async function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || streaming !== null) return;
    setDraft("");
    setError(null);
    const tempSeq = (lines.at(-1)?.seq ?? 0) + 0.5; // 서버 seq 가 오기 전 임시 표시
    setLines((prev) => [...prev, { seq: tempSeq, role: "learner", content: text }]);
    setStreaming("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "전송에 실패했습니다.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.t === "delta") {
            acc += msg.v;
            setStreaming(acc);
          } else if (msg.t === "done") {
            // 서버 순번으로 확정 (수강생 발화는 고객 발화 바로 앞 순번)
            setLines((prev) => prev.filter((l) => Number.isInteger(l.seq)));
            addLine({ seq: msg.seq - 1, role: "learner", content: text });
            addLine({ seq: msg.seq, role: "customer", content: acc.trim() || "…" });
            setStreaming(null);
          } else if (msg.t === "state") {
            setEmotion(msg.emotion);
            // 쉬운 설명: 고객이 대화를 끝냈으면 2.5초 뒤(마지막 말을 읽을 시간) 리포트로 이동합니다.
            if (msg.ended) setTimeout(goReport, 2500);
          } else if (msg.t === "error") {
            setError(msg.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "전송에 실패했습니다.");
    } finally {
      setStreaming(null);
      // 임시 줄 제거 (실시간 구독으로 실제 발화가 들어옴)
      setLines((prev) => prev.filter((l) => Number.isInteger(l.seq)));
    }
  }

  // ───── 음성 모드 ─────
  const voice = useVoiceCall(sessionId, mode === "voice");

  // 쉬운 설명: 음성 연결이 안 될 때 텍스트 대화로 바꿉니다 (PRD L-23).
  async function switchToText() {
    voice.disconnect();
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "text" }),
    });
    if (res.ok) setMode("text");
    else setError((await res.json()).error);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const visibleLines = useMemo(() => lines, [lines]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{view.title}</div>
          <div className="text-xs text-slate-500">
            고객 {view.persona.name} · {mode === "voice" ? "음성 통화" : "텍스트 채팅"}
          </div>
        </div>
        <div className={`ml-auto font-mono text-lg tabular-nums ${remaining <= 60 ? "text-rose-600" : "text-slate-700"}`}>
          {mm}:{ss}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowBriefing((v) => !v)}>
          {showBriefing ? "브리핑 닫기" : "브리핑 보기"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={ending}
          onClick={() => {
            if (confirm("대화를 종료하고 리포트를 받을까요?")) void end("learner_ended");
          }}
        >
          대화 종료
        </Button>
      </header>
      {/* 쉬운 설명: 남은 시간 1분 경고 띠 */}
      {remaining <= 60 && remaining > 0 && (
        <div className="bg-rose-50 px-4 py-1.5 text-center text-sm text-rose-700">1분 뒤 대화가 자동으로 종료됩니다.</div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
            {visibleLines.length === 0 && streaming === null && (
              <p className="mx-auto max-w-md rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                {mode === "voice"
                  ? "고객과 통화가 연결되면 먼저 인사해 주세요. 예) \"안녕하세요, 상담원 OOO입니다.\""
                  : "고객이 채팅에 들어왔습니다. 먼저 인사해 주세요."}
              </p>
            )}
            {visibleLines.map((l) => (
              <Bubble key={l.seq} role={l.role} text={l.content} />
            ))}
            {streaming !== null && <Bubble role="customer" text={streaming || "…"} pending />}
            {mode === "voice" && voice.liveCustomer && <Bubble role="customer" text={voice.liveCustomer} pending />}
            {mode === "voice" && voice.liveLearner && <Bubble role="learner" text={voice.liveLearner} pending />}
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <ErrorText>{error ?? voice.error}</ErrorText>
            {mode === "text" ? (
              <form onSubmit={sendText} className="mt-2 flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  placeholder="고객에게 보낼 메시지 (Enter 전송, Shift+Enter 줄바꿈)"
                  className="min-h-12 flex-1 resize-none"
                  disabled={ending}
                />
                <Button type="submit" disabled={streaming !== null || !draft.trim() || ending}>
                  보내기
                </Button>
              </form>
            ) : (
              <VoiceControls voice={voice} allowText={props.allowText} onSwitchToText={switchToText} />
            )}
          </div>
        </div>

        {showBriefing && (
          <aside className="hidden w-80 shrink-0 space-y-5 overflow-y-auto border-l border-slate-200 bg-white p-4 md:block">
            {view.showEmotionToLearner && <EmotionMeter level={emotion} />}
            <BriefingCard view={view} compact />
          </aside>
        )}
      </div>
    </div>
  );
}

function Bubble({ role, text, pending }: { role: "learner" | "customer"; text: string; pending?: boolean }) {
  const mine = role === "learner";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? "rounded-br-sm bg-brand-500 text-white" : "rounded-bl-sm border border-slate-200 bg-white"
        } ${pending ? "opacity-70" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}

function VoiceControls({
  voice,
  allowText,
  onSwitchToText,
}: {
  voice: ReturnType<typeof useVoiceCall>;
  allowText: boolean;
  onSwitchToText: () => void;
}) {
  const label: Record<string, string> = {
    idle: "연결 전",
    connecting: "연결 중…",
    connected: voice.customerSpeaking ? "고객이 말하는 중" : voice.learnerSpeaking ? "듣고 있어요" : "통화 중",
    failed: "연결 실패",
    closed: "통화 종료",
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${
            voice.state === "connected" ? (voice.customerSpeaking ? "animate-pulse bg-brand-500" : "bg-emerald-500") : "bg-slate-300"
          }`}
        />
        <span className="text-sm font-medium">{label[voice.state]}</span>
      </div>
      {voice.state === "idle" || voice.state === "failed" || voice.state === "closed" ? (
        <Button onClick={voice.connect}>{voice.state === "idle" ? "통화 연결" : "다시 연결"}</Button>
      ) : (
        <Button variant="secondary" onClick={voice.toggleMute} disabled={voice.state !== "connected"}>
          {voice.muted ? "마이크 켜기" : "마이크 끄기"}
        </Button>
      )}
      {allowText && (voice.state === "failed" || voice.error) && (
        <Button variant="ghost" onClick={onSwitchToText}>
          텍스트로 전환
        </Button>
      )}
    </div>
  );
}
