/**
 * ===== 쉬운 설명 =====
 * 무엇: 상시 서버 본체. ① 웹앱의 '통화 기록 시작' 요청 받기 ② 리포트 대기열 처리 시작 ③ 1분마다 방치된 대화 정리.
 * 언제: 상시 서버가 켜져 있는 동안 계속.
 * 리뷰 포인트: /health 주소로 서버 상태(기록 중인 통화 수, 처리 중인 작업 수)를 확인할 수 있습니다.
 * =====================
 */
import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { activeSidebands, attachSideband, sweepAbandoned } from "./sideband";
import { queueStats, startQueueLoop, stopQueueLoop } from "./queue";

const app = Fastify({ logger: { level: "info" } });

// 쉬운 설명: 웹앱만 이 서버에 요청할 수 있도록 비밀값을 확인합니다.
function authorized(header: unknown) {
  if (typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(env.sharedSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

app.get("/health", async () => ({ ok: true, sidebands: activeSidebands(), ...queueStats() }));

app.post<{ Body: { sessionId?: string; callId?: string } }>("/sideband/attach", async (req, reply) => {
  if (!authorized(req.headers["x-worker-secret"])) return reply.code(401).send({ error: "unauthorized" });
  const { sessionId, callId } = req.body ?? {};
  if (!sessionId || !callId) return reply.code(400).send({ error: "sessionId, callId required" });
  try {
    await attachSideband(sessionId, callId);
    return { ok: true };
  } catch (e) {
    req.log.error(e);
    return reply.code(409).send({ error: e instanceof Error ? e.message : "attach failed" });
  }
});

startQueueLoop();
// 쉬운 설명: 1분마다 방치된 대화를 정리합니다.
const sweeper = setInterval(() => void sweepAbandoned().catch((e) => console.error("[sweep]", e)), 60_000);

const shutdown = async () => {
  stopQueueLoop();
  clearInterval(sweeper);
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: env.port, host: "0.0.0.0" });
console.log(`[worker] listening on :${env.port}`);
