/**
 * ===== 쉬운 설명 =====
 * 무엇: 음성 통화 기록 담당. 진행 중인 음성 통화에 옆에서 붙어 수강생·고객 발화를 순서대로 저장하고, 고객 감정을 판단하고,
 *     시간·턴 제한이나 고객의 대화 종료 시 통화를 끊습니다.
 * 언제: 음성 대화가 진행되는 동안.
 * 리뷰 포인트: 음성 대화의 규칙(제한 시간 + 15초 여유, 고객이 끝낼 때 5초 기다렸다 끊기, 10분간 아무 말 없으면 '중단'으로
 *         정리)이 운영 기준과 맞는지 확인하세요.
 * =====================
 */
import WebSocket from "ws";
import type { CohortRow, ScenarioContent, SessionRow } from "@inhub/shared";
import {
  addUsage,
  appendMessage,
  classifyCustomerState,
  db,
  endSession,
  getMessages,
  hangupCall,
  loadScenarioContent,
} from "./clients";
import { env } from "./env";

/**
 * 음성 통화 사이드밴드.
 * 브라우저 ↔ OpenAI WebRTC 통화에 서버가 WebSocket 으로 함께 붙어서
 *  - 양쪽 발화 전사문을 순서대로 DB 에 저장하고
 *  - 고객 발화마다 감정·종료 의사를 판단하고
 *  - 시간/턴 제한, 고객의 대화 종료 시 통화를 끊고 평가 대기열에 넣는다.
 */
class SidebandSession {
  private ws: WebSocket | null = null;
  private ended = false;
  private writeChain: Promise<unknown> = Promise.resolve();
  private pendingUserItems = new Set<string>();
  private learnerTurns = 0;
  private emotion: number;
  private timeLimitTimer: NodeJS.Timeout | null = null;
  private endTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly session: SessionRow,
    readonly callId: string,
    readonly content: ScenarioContent,
    readonly timeLimitSec: number,
    initialLearnerTurns: number,
  ) {
    this.emotion = session.current_emotion ?? content.persona.initialEmotion;
    this.learnerTurns = initialLearnerTurns;
  }

  start() {
    const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(this.callId)}`;
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${env.openaiKey}` } });
    this.ws = ws;
    ws.on("open", () => log(this.session.id, "sideband connected"));
    ws.on("message", (raw: WebSocket.RawData) => this.onEvent(raw.toString()));
    ws.on("error", (e: Error) => log(this.session.id, "sideband error", e.message));
    ws.on("close", (code: number) => {
      log(this.session.id, "sideband closed", code);
      this.dispose();
      registry.delete(this.session.id, this);
    });

    const elapsed = (Date.now() - new Date(this.session.started_at).getTime()) / 1000;
    // 쉬운 설명: 제한 시간 + 15초 여유가 지나면 통화를 끊고 대화를 종료합니다.
    const remain = Math.max(5, this.timeLimitSec - elapsed + 15);
    this.timeLimitTimer = setTimeout(() => void this.finish("time_limit"), remain * 1000);
  }

  close() {
    this.dispose();
    this.ws?.close();
  }

  private dispose() {
    if (this.timeLimitTimer) clearTimeout(this.timeLimitTimer);
    if (this.endTimer) clearTimeout(this.endTimer);
  }

  /** DB 쓰기는 도착 순서대로 직렬 처리 */
  private enqueue(task: () => Promise<unknown>) {
    this.writeChain = this.writeChain.then(task).catch((e) => log(this.session.id, "write failed", String(e)));
    return this.writeChain;
  }

  private onEvent(raw: string) {
    if (this.ended) return;
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    switch (ev.type) {
      case "input_audio_buffer.committed":
        if (ev.item_id) this.pendingUserItems.add(ev.item_id);
        break;

      // 쉬운 설명: 수강생 말이 글자로 바뀌면 저장합니다.
      case "conversation.item.input_audio_transcription.completed": {
        if (ev.item_id) this.pendingUserItems.delete(ev.item_id);
        const text = String(ev.transcript ?? "").trim();
        if (text) {
          this.learnerTurns += 1;
          void this.enqueue(() => appendMessage(this.session.id, "learner", text));
        }
        break;
      }

      case "conversation.item.input_audio_transcription.failed":
        if (ev.item_id) this.pendingUserItems.delete(ev.item_id);
        break;

      // 쉬운 설명: AI 고객 말이 끝나면 그 글자를 저장합니다.
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = String(ev.transcript ?? "").trim();
        if (text) void this.onCustomerUtterance(text);
        break;
      }

      // 쉬운 설명: AI가 한 번 말할 때마다 사용량(비용 계산용)을 누적합니다.
      case "response.done": {
        const u = ev.response?.usage;
        if (u) {
          void addUsage(this.session.id, {
            rt_audio_input_tokens: (u.input_token_details?.audio_tokens ?? 0) - (u.input_token_details?.cached_tokens_details?.audio_tokens ?? 0),
            rt_cached_input_tokens: u.input_token_details?.cached_tokens ?? 0,
            rt_text_input_tokens: u.input_token_details?.text_tokens ?? 0,
            rt_audio_output_tokens: u.output_token_details?.audio_tokens ?? 0,
            rt_text_output_tokens: u.output_token_details?.text_tokens ?? 0,
          }).catch(() => {});
        }
        break;
      }

      case "error":
        log(this.session.id, "realtime error", JSON.stringify(ev.error ?? ev));
        break;
    }
  }

  /**
   * 고객 발화 저장. 수강생 발화 전사가 아직 끝나지 않았다면 최대 4초 기다려 순서를 맞춘다.
   * (음성 전사는 비동기라 고객 답변보다 늦게 도착할 수 있음)
   */
  private async onCustomerUtterance(text: string) {
    // 쉬운 설명: 수강생 말의 자막이 늦게 도착할 수 있어 최대 4초 기다려 발화 순서를 맞춥니다.
    const deadline = Date.now() + 4000;
    while (this.pendingUserItems.size > 0 && Date.now() < deadline) await sleep(100);
    this.pendingUserItems.clear();

    await this.enqueue(async () => {
      await appendMessage(this.session.id, "customer", text);
      const lines = (await getMessages(this.session.id)).map((m) => ({ seq: m.seq, role: m.role, content: m.content }));
      const { state, usage } = await classifyCustomerState(this.content, lines, this.emotion);
      this.emotion = state.emotion;
      await db.rpc("set_customer_emotion", { p_session_id: this.session.id, p_emotion: state.emotion });
      await addUsage(this.session.id, usage);

      // 쉬운 설명: 고객이 만족/화가 나서 끝내려 하거나 최대 턴을 넘으면 종료를 예약합니다.
      if (state.endConversation) this.scheduleFinish(state.resolved ? "resolved" : "customer_left");
      else if (this.learnerTurns >= this.content.maxTurns) this.scheduleFinish("turn_limit");
    });
  }

  /** 고객의 마지막 말이 다 재생되도록 잠시 기다렸다가 종료 */
  private scheduleFinish(reason: string) {
    if (this.endTimer) return;
    // 쉬운 설명: 고객의 마지막 말이 다 들리도록 5초 뒤에 끊습니다.
    this.endTimer = setTimeout(() => void this.finish(reason), 5000);
  }

  async finish(reason: string) {
    if (this.ended) return;
    this.ended = true;
    this.dispose();
    await this.writeChain.catch(() => {});
    try {
      await endSession(this.session.id, reason);
    } catch (e) {
      log(this.session.id, "end failed", String(e));
    }
    await hangupCall(this.callId);
    this.ws?.close();
    log(this.session.id, "finished", reason);
  }
}

class Registry {
  private map = new Map<string, SidebandSession>();
  set(id: string, s: SidebandSession) {
    this.map.get(id)?.close();
    this.map.set(id, s);
  }
  delete(id: string, s: SidebandSession) {
    if (this.map.get(id) === s) this.map.delete(id);
  }
  get size() {
    return this.map.size;
  }
}
const registry = new Registry();

export function activeSidebands() {
  return registry.size;
}

/** 웹앱이 통화를 연결한 직후 호출 */
export async function attachSideband(sessionId: string, callId: string) {
  const { data: s } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!s) throw new Error("session not found");
  const session = s as SessionRow;
  if (session.status !== "active") throw new Error("session not active");
  if (session.openai_call_id !== callId) throw new Error("call id mismatch");

  const { data: c } = await db.from("cohorts").select("*").eq("id", session.cohort_id).single();
  const cohort = c as CohortRow;
  const content = await loadScenarioContent(session.scenario_id, session.scenario_version);
  const learnerTurns = (await getMessages(session.id)).filter((m) => m.role === "learner").length;

  const sb = new SidebandSession(session, callId, content, cohort.time_limit_sec ?? content.timeLimitSec, learnerTurns);
  registry.set(sessionId, sb);
  sb.start();
}

/**
 * 방치된 세션 정리: 브라우저를 닫고 떠난 경우 등.
 * 마지막 활동 후 10분이 지나면 종료하고 평가로 넘긴다.
 */
// 쉬운 설명: 브라우저를 닫고 떠난 대화 정리: 마지막 발화 후 10분이 지나면 '응답 없이 중단'으로 끝내고 평가합니다.
export async function sweepAbandoned() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await db
    .from("sessions")
    .select("id, openai_call_id")
    .eq("status", "active")
    .lt("last_activity_at", cutoff)
    .limit(50);
  for (const s of (data ?? []) as { id: string; openai_call_id: string | null }[]) {
    if (await endSession(s.id, "abandoned").catch(() => false)) {
      if (s.openai_call_id) await hangupCall(s.openai_call_id);
      log(s.id, "abandoned session closed");
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function log(sessionId: string, ...args: unknown[]) {
  console.log(`[sideband ${sessionId.slice(0, 8)}]`, ...args);
}
