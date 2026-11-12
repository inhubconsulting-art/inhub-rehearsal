"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 방식(음성/텍스트) 선택, 마이크 점검, '고객 연결하기' 버튼.
 * 언제: 브리핑 화면 오른쪽.
 * 리뷰 포인트: 마이크 점검 안내 문구와 '먼저 인사해 주세요' 안내가 적절한지 확인하세요(PRD L-23).
 * =====================
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationMode } from "@inhub/shared";
import { Button, ErrorText } from "@/components/ui";

/** 대화 방식 선택 + 마이크 점검 (PRD L-23) + 시작 */
export function StartScenario({
  cohortId,
  scenarioId,
  allowedModes,
  channel,
  running,
}: {
  cohortId: string;
  scenarioId: string;
  allowedModes: ConversationMode[];
  channel: "phone" | "chat";
  running: boolean;
}) {
  const router = useRouter();
  const preferred: ConversationMode = channel === "phone" && allowedModes.includes("voice") ? "voice" : allowedModes[0];
  const [mode, setMode] = useState<ConversationMode>(preferred);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  async function testMic() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        raf = requestAnimationFrame(tick);
      };
      tick();
      setMicOk(true);
      cleanup.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
      };
    } catch {
      setMicOk(false);
      setError("마이크를 사용할 수 없습니다. 브라우저 주소창의 마이크 권한을 허용하거나 텍스트 모드를 선택하세요.");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    cleanup.current();
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId, scenarioId, mode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(json.error);
    }
    router.push(`/learn/session/${json.sessionId}`);
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">대화 방식</h3>
      <div className="grid gap-2">
        {allowedModes.includes("voice") && (
          <ModeOption checked={mode === "voice"} onClick={() => setMode("voice")} title="음성 통화" desc="마이크로 말하고 AI 고객의 목소리로 듣습니다. 헤드셋을 권장합니다." />
        )}
        {allowedModes.includes("text") && (
          <ModeOption checked={mode === "text"} onClick={() => setMode("text")} title="텍스트 채팅" desc="채팅으로 응대합니다." />
        )}
      </div>

      {mode === "voice" && (
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">마이크 점검</span>
            <Button size="sm" variant="secondary" onClick={testMic}>
              {micOk ? "다시 점검" : "점검하기"}
            </Button>
          </div>
          {micOk && (
            <>
              <div className="h-2 overflow-hidden rounded bg-slate-100">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${level * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">말해 보세요. 막대가 움직이면 정상입니다.</p>
            </>
          )}
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <Button size="lg" className="w-full" onClick={start} disabled={busy || !running}>
        {!running ? "지금은 실습 시간이 아닙니다" : busy ? "연결 중…" : "고객 연결하기"}
      </Button>
      <p className="text-xs text-slate-500">연결되면 상담원인 여러분이 먼저 인사해 주세요.</p>
    </div>
  );
}

function ModeOption({ checked, onClick, title, desc }: { checked: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${checked ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </button>
  );
}
