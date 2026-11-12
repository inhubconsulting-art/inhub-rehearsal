/**
 * ===== 쉬운 설명 =====
 * 무엇: 음성 통화를 연결하는 서버 창구. 브라우저의 연결 요청을 OpenAI에 전달하고, 상시 서버에게 '이 통화를 옆에서
 *     기록하라'고 알립니다.
 * 언제: 음성 모드 대화 화면에 들어올 때, 또는 '다시 연결'을 누를 때.
 * 리뷰 포인트: 다시 연결할 때 지금까지의 대화를 AI 고객에게 알려줘서 처음부터 다시 시작하지 않게 하는 부분을 확인하세요.
 * =====================
 */
import { createHash } from "node:crypto";
import { buildCustomerInstructions } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getMessages, getOwnSession, hangupCall, loadScenarioContent } from "@/lib/domain";
import { serverEnv } from "@/lib/env";

export const maxDuration = 30;

/**
 * 음성 통화 연결 (OpenAI Realtime "unified interface").
 * 브라우저의 SDP offer 를 받아 서버 API 키로 /v1/realtime/calls 에 전달하고 SDP answer 를 돌려준다.
 * 응답 Location 헤더의 call ID 로 상시 서버(worker)가 같은 통화에 사이드밴드로 붙어 전사·감정·종료를 처리한다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser();
    const session = await getOwnSession(u, id);
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 대화입니다.");
    if (session.mode !== "voice") throw new HttpError(400, "음성 대화가 아닙니다.");

    const offer = await req.text();
    if (!offer.startsWith("v=")) throw new HttpError(400, "잘못된 연결 요청입니다.");

    const content = await loadScenarioContent(session.scenario_id, session.scenario_version);
    let instructions = buildCustomerInstructions(content, "voice");

    // 재접속: 이전 통화를 정리하고 지금까지의 대화를 이어서 진행
    // 쉬운 설명: 다시 연결하는 경우: 이전 통화를 끊고, 지금까지의 대화를 AI 고객에게 알려 이어서 말하게 합니다.
    if (session.openai_call_id) {
      await hangupCall(session.openai_call_id).catch(() => {});
      const prev = await getMessages(session.id);
      if (prev.length) {
        const transcript = prev
          .map((m) => `${m.role === "learner" ? "상담원" : "고객(당신)"}: ${m.content}`)
          .join("\n");
        instructions += `\n\n# 통화가 잠시 끊겼다가 다시 연결되었습니다\n지금까지의 대화:\n${transcript}\n\n다시 연결된 것을 짧게 언급하고 대화를 이어가세요. 처음 용건을 다시 말하지 마세요.`;
      }
    }

    // 쉬운 설명: 음성 통화 설정: 사용할 모델, AI 고객 지시문, 한국어 자막(전사), 목소리.
    const sessionConfig = {
      type: "realtime",
      model: serverEnv.realtimeModel,
      instructions,
      audio: {
        input: {
          transcription: { model: serverEnv.transcribeModel, language: "ko" },
          turn_detection: { type: "server_vad" },
        },
        output: { voice: content.voice.voice },
      },
    };

    const fd = new FormData();
    fd.set("sdp", offer);
    fd.set("session", JSON.stringify(sessionConfig));

    // 쉬운 설명: OpenAI에 통화를 연결합니다. API 키는 서버에만 있고 브라우저로 나가지 않습니다.
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.openaiKey}`,
        "OpenAI-Safety-Identifier": createHash("sha256").update(u.id).digest("hex"),
      },
      body: fd,
    });
    if (!r.ok) {
      console.error("realtime call failed", r.status, await r.text());
      throw new HttpError(502, "음성 연결에 실패했습니다. 잠시 후 다시 시도하거나 텍스트 모드를 이용해 주세요.");
    }
    const answer = await r.text();
    const callId = r.headers.get("Location")?.split("/").pop() ?? null;

    // 쉬운 설명: 통화 번호를 저장하고, 상시 서버에게 '이 통화를 옆에서 기록해 달라'고 요청합니다.
    if (callId) {
      await adminClient().from("sessions").update({ openai_call_id: callId }).eq("id", session.id);
      // 사이드밴드 연결 요청 (실패해도 통화는 진행되지만 기록이 남지 않으므로 로그를 남김)
      try {
        const w = await fetch(`${serverEnv.workerUrl}/sideband/attach`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-worker-secret": serverEnv.workerSecret },
          body: JSON.stringify({ sessionId: session.id, callId }),
        });
        if (!w.ok) console.error("worker attach failed", w.status, await w.text());
      } catch (e) {
        console.error("worker unreachable", e);
      }
    } else {
      console.error("realtime call id missing (Location header)");
    }

    return new Response(answer, { headers: { "Content-Type": "application/sdp" } });
  } catch (e) {
    return apiError(e);
  }
}
