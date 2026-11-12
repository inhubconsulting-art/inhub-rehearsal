/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트 대기열 처리기. 1.5초마다 대기열을 확인해 일을 꺼내고, 동시에 너무 많이 돌지 않게 개수를 제한합니다. 실패하면
 *     3번까지 다시 시도합니다.
 * 언제: 상시 서버가 켜져 있는 동안 계속.
 * 리뷰 포인트: 30명이 동시에 끝내도 순서대로 처리되는 구조인지 정도만 보면 됩니다(PRD L-30).
 * =====================
 */
import type { JobPayload } from "@inhub/shared";
import { db } from "./clients";
import { env } from "./env";
import { evaluateSession, markJobFailed, summarizeCohort } from "./jobs";

// 쉬운 설명: 같은 작업이 3번 실패하면 포기하고 '평가 실패'로 표시합니다.
const MAX_ATTEMPTS = 3;
/** 작업을 꺼낸 뒤 다른 워커에게 보이지 않는 시간(초). 처리 실패 시 이 시간이 지나면 다시 시도된다. */
const VISIBILITY_SEC = 180;

let running = 0;
let stopped = false;

export function queueStats() {
  return { running };
}

/** Supabase Queues(pgmq) 에서 작업을 꺼내 동시 처리 수를 제한하며 실행 (PRD L-30, 8장 레이트 리밋 대응) */
export function startQueueLoop() {
  const tick = async () => {
    if (stopped) return;
    try {
      // 쉬운 설명: 동시에 처리할 수 있는 빈자리만큼만 대기열에서 꺼냅니다.
      const free = env.evalConcurrency - running;
      if (free > 0) {
        const { data, error } = await db.rpc("read_jobs", { vt: VISIBILITY_SEC, qty: free });
        if (error) throw error;
        for (const msg of (data ?? []) as { msg_id: number; read_ct: number; message: JobPayload }[]) {
          running += 1;
          void handle(msg).finally(() => (running -= 1));
        }
      }
    } catch (e) {
      console.error("[queue] read failed", e);
    }
    setTimeout(tick, 1500);
  };
  void tick();
}

export function stopQueueLoop() {
  stopped = true;
}

async function handle(msg: { msg_id: number; read_ct: number; message: JobPayload }) {
  const job = msg.message;
  const started = Date.now();
  try {
    if (job.kind === "evaluate_session" && job.sessionId) await evaluateSession(job.sessionId);
    else if (job.kind === "summarize_cohort" && job.cohortId) await summarizeCohort(job.cohortId);
    await db.rpc("delete_job", { p_msg_id: msg.msg_id });
    console.log(`[queue] ${job.kind} done in ${Date.now() - started}ms`);
  } catch (e) {
    console.error(`[queue] ${job.kind} failed (attempt ${msg.read_ct})`, e);
    if (msg.read_ct >= MAX_ATTEMPTS) {
      await markJobFailed(job).catch(() => {});
      await db.rpc("archive_job", { p_msg_id: msg.msg_id });
    }
  }
}
