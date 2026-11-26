/**
 * ===== 쉬운 설명 =====
 * 무엇: 시뮬레이터 시작 버튼. 시나리오 × 케이스 × 반복 횟수만큼 실습을 돌리고 결과 파일을 만듭니다.
 * 언제: 저장소 맨 위 폴더에서  npm run sim  (옵션은 아래 도움말 또는 scripts/simulate/README.md)
 * 리뷰 포인트:
 *   - 운영 DB 에는 아무것도 쓰지 않습니다(시나리오·표현 목록을 읽기만 함). 결과는 simulations/ 폴더에만 남습니다.
 *   - 실제 OpenAI 를 부르므로 비용이 듭니다. 처음엔 --quick 으로 작게 돌려 보세요.
 * =====================
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROMPT_VERSION, type Lexicon } from "../../packages/shared/src/index.ts";
import { CASES, pickCases, type SimCase } from "./cases.ts";
import { runSession, type EngineConfig } from "./engine.ts";
import { realLlm } from "./llm.ts";
import { mockLlm } from "./mock.ts";
import { PARTICIPANTS, seededShuffle } from "./participants.ts";
import { appendJsonl, writeHtml, writeTables } from "./report.ts";
import { filterScenarios, loadFromDb, loadFromSeed } from "./scenarios.ts";
import type { SessionRecord, SimScenario } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

const HELP = `인허브 리허설 · 대화 시뮬레이터

사용법:  npm run sim -- [옵션]

  --quick               핵심 케이스 8개만 (처음 돌려 볼 때 추천)
  --cases C01,C05       고른 케이스만 (앞부분만 써도 됨)
  --scenarios 여권,건강  고른 시나리오만 (제목 일부 또는 id 앞부분)
  --repeat 3            같은 조합을 여러 번 (매번 다른 참여자)
  --concurrency 3       동시에 돌릴 실습 수 (기본 3, OpenAI 한도에 걸리면 줄이기)
  --source db|seed      시나리오를 운영 DB(읽기만)에서 / seed.sql 에서 (기본: DB 접속 정보가 있으면 db)
  --drafts              DB 의 초안(draft) 시나리오도 포함
  --time-limit 300      모든 시나리오의 제한 시간(초)을 바꿔서 테스트
  --label 지시문수정후   실행 이름에 붙일 메모
  --mock                가짜 AI 로 흐름만 점검 (비용 없음, 인터넷 불필요)
  --out 폴더             결과를 simulations/ 대신 다른 폴더에
  --list                케이스 목록만 보기

케이스: ${CASES.map((c) => `${c.id}${c.core ? "*" : ""}`).join(", ")}   (* = --quick 포함)`;

function parseArgs(argv: string[]) {
  const o: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      o[k] = next;
      i++;
    } else o[k] = true;
  }
  return o;
}
const list = (v: unknown) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);

function loadEnv() {
  for (const p of [join(REPO, ".env"), join(REPO, "apps", "web", ".env.local")]) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* 무시 */
      }
    }
  }
}

function kstStamp() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) return console.log(HELP);
  if (args.list) {
    for (const c of CASES) console.log(`${c.id.padEnd(22)} ${c.core ? "*" : " "} [${c.group}] ${c.label} — ${c.description}`);
    return;
  }
  loadEnv();
  const mock = !!args.mock;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!mock && !apiKey) {
    console.error("OPENAI_API_KEY 가 없습니다. 저장소 맨 위 .env 를 확인하세요. (흐름만 보려면 --mock)");
    process.exit(1);
  }

  // ----- 시나리오 -----
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let source = (typeof args.source === "string" ? args.source : supaUrl && supaKey && !mock ? "db" : "seed") as "db" | "seed";
  let loaded: { scenarios: SimScenario[]; lexicon: Lexicon };
  if (source === "db") {
    try {
      loaded = await loadFromDb(supaUrl!, supaKey!, !!args.drafts);
      if (!loaded.scenarios.length) throw new Error("공개된 시나리오가 없습니다");
    } catch (e) {
      console.warn(`! 운영 DB 에서 시나리오를 읽지 못해 seed.sql 로 대신합니다: ${(e as Error).message}`);
      source = "seed";
      loaded = loadFromSeed(REPO);
    }
  } else loaded = loadFromSeed(REPO);
  const scenarios = filterScenarios(loaded.scenarios, list(args.scenarios));
  const cases = pickCases(list(args.cases), !!args.quick);
  const repeat = Math.max(1, Number(args.repeat ?? 1));
  if (!scenarios.length || !cases.length) {
    console.error("돌릴 시나리오 또는 케이스가 없습니다. --scenarios / --cases 를 확인하세요.");
    process.exit(1);
  }

  // ----- 설정 (서비스와 같은 환경변수) -----
  const chat = process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
  const cfg: EngineConfig = {
    llm: mock ? mockLlm() : realLlm(apiKey!),
    models: {
      customer: chat,
      classifier: process.env.OPENAI_CLASSIFIER_MODEL || "gpt-5-mini",
      eval: process.env.OPENAI_EVAL_MODEL || "gpt-5-mini",
      learnerSim: process.env.SIM_LEARNER_MODEL || chat,
    },
    serviceReasoning: process.env.OPENAI_REASONING_EFFORT || null,
    simReasoning: process.env.SIM_REASONING_EFFORT ?? "low",
    lexicon: loaded.lexicon,
    timeLimitOverride: args["time-limit"] ? Number(args["time-limit"]) : null,
    prices: { textIn: Number(process.env.PRICE_TEXT_IN) || 0.25, textOut: Number(process.env.PRICE_TEXT_OUT) || 2 },
  };

  // ----- 실행 계획: 조합마다 참여자를 다르게 배정 -----
  type Job = { scenario: SimScenario; sc: SimCase; repeat: number };
  const jobs: Job[] = [];
  for (const s of scenarios) for (const c of cases) for (let r = 1; r <= repeat; r++) jobs.push({ scenario: s, sc: c, repeat: r });
  const people = seededShuffle(PARTICIPANTS, `${scenarios.map((s) => s.id).join()}${cases.map((c) => c.id).join()}`);
  const runId = `${kstStamp()}${mock ? "-mock" : ""}${typeof args.label === "string" ? `-${args.label.replace(/[^\p{L}\p{N}_-]/gu, "")}` : ""}`;
  const outRoot = typeof args.out === "string" ? resolve(args.out) : join(REPO, "simulations");
  const dir = join(outRoot, runId);
  mkdirSync(dir, { recursive: true });

  const meta = {
    runId,
    startedAt: new Date().toISOString(),
    finishedAt: null as string | null,
    mock,
    source,
    models: cfg.models,
    reasoning: cfg.serviceReasoning,
    simReasoning: cfg.simReasoning,
    promptVersion: PROMPT_VERSION,
    scenarios: scenarios.map((s) => ({ id: s.id, version: s.version, title: s.content.title, timeLimitSec: s.content.timeLimitSec, maxTurns: s.content.maxTurns })),
    cases: cases.map((c) => c.id),
    repeat,
    timeLimitOverride: cfg.timeLimitOverride,
    totalSessions: jobs.length,
  };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  console.log(`\n인허브 리허설 시뮬레이션 ${runId}`);
  console.log(`  시나리오 ${scenarios.length}개 (${source}) × 케이스 ${cases.length}개 × ${repeat}회 = 실습 ${jobs.length}회`);
  console.log(`  모델: 고객 ${cfg.models.customer} · 판단 ${cfg.models.classifier} · 평가 ${cfg.models.eval} · 가상 수강생 ${cfg.models.learnerSim}${mock ? "  [가짜 AI]" : ""}`);
  console.log(`  결과 폴더: ${dir}\n`);

  const recs: SessionRecord[] = [];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    meta.finishedAt = new Date().toISOString();
    writeFileSync(join(dir, "meta.json"), JSON.stringify({ ...meta, completedSessions: recs.length }, null, 2), "utf8");
    const ordered = [...recs].sort((a, b) => a.scenario.title.localeCompare(b.scenario.title) || a.caseId.localeCompare(b.caseId) || a.repeat - b.repeat);
    writeTables(dir, outRoot, ordered);
    writeHtml(dir, meta, ordered, CASES);
    const fails = ordered.reduce((s, r) => s + r.expectations.filter((e) => !e.passed).length, 0);
    const errs = ordered.filter((r) => r.anomalies.some((a) => a.severity === "error")).length;
    const cost = ordered.reduce((s, r) => s + r.costUsd.service + r.costUsd.simulator, 0);
    console.log(`\n완료: 실습 ${ordered.length}/${jobs.length}회 · 기대 결과 실패 ${fails}건 · 오류 표시 실습 ${errs}회 · 추정 비용 $${cost.toFixed(3)}`);
    console.log(`리포트: ${join(dir, "report.html")}`);
  };
  process.on("SIGINT", () => {
    console.log("\n중단 요청: 지금까지 끝난 실습으로 리포트를 만듭니다.");
    finish();
    process.exit(130);
  });

  await pool(jobs, Number(args.concurrency ?? 3), async (job, idx) => {
    const participant = people[idx % people.length];
    const rec = await runSession({ cfg, runId, scenario: job.scenario, sc: job.sc, participant, repeat: job.repeat });
    recs.push(rec);
    appendJsonl(dir, rec);
    const fails = rec.expectations.filter((e) => !e.passed).length;
    const warn = rec.anomalies.filter((a) => a.severity !== "info").length;
    console.log(
      `[${String(recs.length).padStart(3)}/${jobs.length}] ${rec.scenario.title} · ${rec.caseId} ${rec.caseLabel} · ${participant.name}` +
        ` → ${rec.endReason ?? "-"}(${rec.endedBy ?? "-"}) ${rec.turns.length}턴 감정 ${rec.emotionPath.join(">")}` +
        ` ${rec.evaluation.result ? `${rec.evaluation.result.totalScore}점` : "평가없음"}` +
        `${fails ? `  기대✗${fails}` : "  기대✓"}${warn ? `  이상${warn}` : ""}${rec.error ? `  오류: ${rec.error}` : ""}`,
    );
  });
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
