"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 음성 통화 연결 담당. 마이크를 켜고 OpenAI와 직접 음성을 주고받으며, '고객이 말하는 중' 표시와 실시간 자막을
 *     처리합니다.
 * 언제: 음성 모드 대화 화면에 들어오면 자동으로 연결합니다.
 * 리뷰 포인트: 마이크 권한 거부, 연결 끊김 때의 안내 문구를 확인하세요. 기술적인 부분은 개발자 리뷰 대상입니다.
 * =====================
 */
import { useCallback, useEffect, useRef, useState } from "react";

type CallState = "idle" | "connecting" | "connected" | "failed" | "closed";

/**
 * OpenAI Realtime WebRTC 통화.
 * 브라우저 ↔ OpenAI 가 직접 음성을 주고받고(지연 최소), 연결 협상(SDP)만 우리 서버를 거친다.
 * 확정된 발화는 서버(사이드밴드)가 DB에 저장하고 실시간 구독으로 화면에 들어온다.
 * 여기서는 말하는 중 표시와 실시간 자막(미확정)만 처리한다.
 */
export function useVoiceCall(sessionId: string, enabled: boolean) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [customerSpeaking, setCustomerSpeaking] = useState(false);
  const [learnerSpeaking, setLearnerSpeaking] = useState(false);
  const [liveCustomer, setLiveCustomer] = useState("");
  const [liveLearner, setLiveLearner] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const disconnect = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setCustomerSpeaking(false);
    setLearnerSpeaking(false);
    setLiveCustomer("");
    setLiveLearner("");
  }, []);

  const connect = useCallback(async () => {
    disconnect();
    setError(null);
    setState("connecting");
    try {
      // 쉬운 설명: 마이크를 켭니다. 메아리·잡음 제거를 켜 둡니다.
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micRef.current = mic;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      if (!audioRef.current) {
        audioRef.current = document.createElement("audio");
        audioRef.current.autoplay = true;
      }
      pc.ontrack = (e) => {
        if (audioRef.current) audioRef.current.srcObject = e.streams[0];
      };
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // 쉬운 설명: OpenAI가 보내는 신호(누가 말하는 중인지, 실시간 자막)를 받는 통로입니다.
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (e) => {
        let ev: { type: string; delta?: string };
        try {
          ev = JSON.parse(e.data);
        } catch {
          return;
        }
        switch (ev.type) {
          case "input_audio_buffer.speech_started":
            setLearnerSpeaking(true);
            setLiveLearner("");
            break;
          case "input_audio_buffer.speech_stopped":
            setLearnerSpeaking(false);
            break;
          case "conversation.item.input_audio_transcription.delta":
            setLiveLearner((t) => t + (ev.delta ?? ""));
            break;
          case "conversation.item.input_audio_transcription.completed":
            setLiveLearner("");
            break;
          case "output_audio_buffer.started":
            setCustomerSpeaking(true);
            break;
          case "output_audio_buffer.stopped":
          case "output_audio_buffer.cleared":
            setCustomerSpeaking(false);
            break;
          case "response.output_audio_transcript.delta":
          case "response.audio_transcript.delta":
            setLiveCustomer((t) => t + (ev.delta ?? ""));
            break;
          case "response.output_audio_transcript.done":
          case "response.audio_transcript.done":
          case "response.done":
            setLiveCustomer("");
            break;
          case "error":
            console.warn("realtime error", ev);
            break;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setState("connected");
        if (pc.connectionState === "failed") {
          setState("failed");
          setError("음성 연결이 끊겼습니다. 다시 연결해 주세요.");
        }
        if (pc.connectionState === "closed" || pc.connectionState === "disconnected") setState("closed");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // 쉬운 설명: 연결 요청서를 우리 서버에 보내면, 서버가 OpenAI와 연결해 답장을 돌려줍니다.
      const res = await fetch(`/api/sessions/${sessionId}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "음성 연결에 실패했습니다.");
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    } catch (err) {
      disconnect();
      setState("failed");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "마이크 권한이 필요합니다. 주소창의 마이크 아이콘에서 허용해 주세요."
          : err instanceof Error
            ? err.message
            : "음성 연결에 실패했습니다.",
      );
    }
  }, [disconnect, sessionId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  // 페이지 진입 시 자동 연결, 떠날 때 정리
  useEffect(() => {
    if (!enabled) return;
    void connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    state,
    error,
    muted,
    customerSpeaking,
    learnerSpeaking,
    liveCustomer,
    liveLearner,
    connect,
    disconnect,
    toggleMute,
  };
}
