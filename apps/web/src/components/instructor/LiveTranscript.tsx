"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 진행 중인 대화를 실시간으로 보여주는 화면 부품.
 * 언제: 강사용 대화 상세(진행 중).
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { emotionLabel } from "@inhub/shared";
import { browserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { EmotionMeter } from "@/components/EmotionMeter";

type Line = { seq: number; role: "learner" | "customer"; content: string; emotion: number | null };

/** 진행 중인 대화 실시간 열람 (읽기 전용) */
export function LiveTranscript({ sessionId, initial, startedAt }: { sessionId: string; initial: Line[]; startedAt: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial);
  const [emotion, setEmotion] = useState<number | null>(initial.filter((l) => l.role === "customer").at(-1)?.emotion ?? null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = browserClient();
    const ch = supabase
      .channel(`live:${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` }, (p) => {
        const m = p.new as Line;
        setLines((prev) => (prev.some((x) => x.seq === m.seq) ? prev : [...prev, m].sort((a, b) => a.seq - b.seq)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` }, (p) => {
        const m = p.new as Line;
        setLines((prev) => prev.map((x) => (x.seq === m.seq ? m : x)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (p) => {
        const s = p.new as { status: string; current_emotion: number | null };
        setEmotion(s.current_emotion);
        if (s.status !== "active") router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, router]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [lines]);
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <Card className="max-h-[70vh] overflow-y-auto">
        <div className="space-y-2 text-sm">
          {lines.length === 0 && <p className="text-slate-500">아직 발화가 없습니다.</p>}
          {lines.map((m) => (
            <div key={m.seq} className="flex gap-3">
              <span className="w-8 shrink-0 text-right text-xs text-slate-400">#{m.seq}</span>
              <span className={`w-14 shrink-0 font-medium ${m.role === "learner" ? "text-brand-600" : "text-slate-500"}`}>
                {m.role === "learner" ? "상담원" : "고객"}
              </span>
              <span className="flex-1">{m.content}</span>
              {m.role === "customer" && m.emotion != null && <span className="shrink-0 text-xs text-slate-400">{emotionLabel(m.emotion)}</span>}
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </Card>
      <Card className="h-fit space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" /> 진행 중 · {mins}분 경과
        </div>
        <EmotionMeter level={emotion} />
        <p className="text-xs text-slate-500">대화가 끝나면 이 화면에 리포트가 자동으로 표시됩니다.</p>
      </Card>
    </div>
  );
}
