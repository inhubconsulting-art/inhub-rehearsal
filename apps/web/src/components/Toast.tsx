"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 화면 아래쪽에 잠깐 떴다 사라지는 알림(예: "공지를 보냈습니다").
 * 쓰는 법: const [toast, showToast] = useToast();  →  화면에 {toast} 를 넣고, 성공했을 때 showToast("보냈습니다") 호출.
 * =====================
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error";

export function useToast(): [ReactNode, (message: string, tone?: Tone) => void] {
  const [msg, setMsg] = useState<{ text: string; tone: Tone; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: Tone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ text, tone, key: Date.now() });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const node = msg ? (
    <div
      key={msg.key}
      role="status"
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
        msg.tone === "success" ? "bg-slate-900" : "bg-rose-600"
      }`}
    >
      {msg.tone === "success" ? "✓ " : ""}
      {msg.text}
    </div>
  ) : null;
  return [node, show];
}
