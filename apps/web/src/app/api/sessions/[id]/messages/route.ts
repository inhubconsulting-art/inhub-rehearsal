/**
 * ===== 쉬운 설명 =====
 * 무엇: 텍스트 대화 한 턴을 처리하는 서버 창구. 수강생 메시지 저장 → AI 고객 답변을 글자 단위로 흘려보냄 → 답변 저장 →
 *     고객 감정·종료 판단 → 필요하면 대화 종료.
 * 언제: 텍스트 모드에서 수강생이 메시지를 보낼 때마다.
 * 리뷰 포인트: 흐름을 위에서 아래로 따라 읽어 보세요. 시간 초과, 턴 수 초과, 고객이 만족/화나서 대화를 끝내는 경우가 모두 처리되는지
 *         확인하세요.
 * =====================
 */
import { z } from "zod";
import { buildCustomerInstructions, type TranscriptLine } from "@inhub/shared";
import { apiError, audit, HttpError, requireApiUser } from "@/lib/auth";
import {
  addUsage,
  appendMessage,
  effectiveTimeLimit,
  endSession,
  getCohort,
  getMessages,
  getOwnSession,
  loadScenarioContent,
  setCustomerEmotion,
} from "@/lib/domain";
import { classifyCustomerState, openai, reasoningOpt } from "@/lib/openai";
import { serverEnv } from "@/lib/env";

export const maxDuration = 60;

const Body = z.object({ content: z.string().trim().min(1).max(2000) });

/**
 * 텍스트 대화 한 턴. 응답은 NDJSON 스트림:
 *  {"t":"delta","v":"..."}  고객 답변 조각
 *  {"t":"done","seq":n}     고객 발화 저장 완료
 *  {"t":"state","emotion":n,"ended":bool,"endReason":string|null}
 *  {"t":"error","message":"..."}
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser();
    const session = await getOwnSession(u, id);
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 대화입니다.");
    if (session.mode !== "text") throw new HttpError(400, "텍스트 대화가 아닙니다.");

    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "메시지를 입력해 주세요.");

    const cohort = await getCohort(session.cohort_id);
    const content = await loadScenarioContent(session.scenario_id, session.scenario_version);
    const limit = effectiveTimeLimit(cohort, content);
    // 쉬운 설명: 제한 시간 + 30초 여유가 지났으면 더 이상 대화하지 않고 종료합니다.
    if (Date.now() - new Date(session.started_at).getTime() > (limit + 30) * 1000) {
      await endSession(session, "time_limit");
      throw new HttpError(409, "대화 시간이 끝났습니다.");
    }

    // 쉬운 설명: 1단계: 수강생 메시지를 저장합니다.
    const learnerMsg = await appendMessage(session.id, "learner", body.data.content);
    // 부적절 발화 기록 (차단하지 않음, PRD 8장 콘텐츠 안전)
    // 쉬운 설명: 부적절한 표현이 있으면 기록만 남깁니다 (대화를 막지는 않음).
    void openai()
      .moderations.create({ model: "omni-moderation-latest", input: body.data.content })
      .then((m) => {
        if (m.results?.[0]?.flagged) return audit(u.id, "moderation_flagged", session.id, { seq: learnerMsg.seq });
      })
      .catch(() => {});

    const history = await getMessages(session.id);
    const input = history.map((m) => ({
      role: m.role === "learner" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
    const instructions = buildCustomerInstructions(content, "text");
    // 쉬운 설명: 수강생 발화 수가 최대 턴 수에 닿았는지 미리 계산해 둡니다.
    const turnLimitReached = history.filter((m) => m.role === "learner").length >= content.maxTurns;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
        try {
          let reply = "";
          const usage: Record<string, number> = {};
          // 쉬운 설명: 2단계: AI 고객 답변을 받아 글자가 생기는 대로 화면에 흘려보냅니다.
          const events = await openai().responses.create({
            model: serverEnv.chatModel,
            ...reasoningOpt(),
            instructions,
            input,
            stream: true,
          });
          for await (const ev of events) {
            if (ev.type === "response.output_text.delta") {
              reply += ev.delta;
              send({ t: "delta", v: ev.delta });
            } else if (ev.type === "response.completed") {
              usage.text_input_tokens = ev.response.usage?.input_tokens ?? 0;
              usage.text_output_tokens = ev.response.usage?.output_tokens ?? 0;
            }
          }
          reply = reply.trim() || "…";
          // 쉬운 설명: 3단계: 완성된 고객 답변을 저장합니다.
          const customerMsg = await appendMessage(session.id, "customer", reply);
          send({ t: "done", seq: customerMsg.seq });

          const lines: TranscriptLine[] = [...history, customerMsg].map((m) => ({
            seq: m.seq,
            role: m.role,
            content: m.content,
          }));
          // 쉬운 설명: 4단계: 고객 감정과 '대화를 끝내려 하는지'를 판단해 기록합니다.
          const { state, usage: cUsage } = await classifyCustomerState(
            content,
            lines,
            session.current_emotion ?? content.persona.initialEmotion,
          );
          await setCustomerEmotion(session.id, state.emotion);
          await addUsage(session.id, {
            text_input_tokens: (usage.text_input_tokens ?? 0) + (cUsage.text_input_tokens ?? 0),
            text_output_tokens: (usage.text_output_tokens ?? 0) + (cUsage.text_output_tokens ?? 0),
          });

          // 쉬운 설명: 5단계: 고객이 만족해서/화나서 끝내거나, 턴 수를 넘으면 대화를 종료합니다.
          let endReason: string | null = null;
          if (state.endConversation) endReason = state.resolved ? "resolved" : "customer_left";
          else if (turnLimitReached) endReason = "turn_limit";
          if (endReason) await endSession(session, endReason);
          send({ t: "state", emotion: state.emotion, ended: Boolean(endReason), endReason });
        } catch (err) {
          console.error(err);
          send({ t: "error", message: "AI 고객 응답 중 오류가 발생했습니다. 다시 보내 주세요." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
