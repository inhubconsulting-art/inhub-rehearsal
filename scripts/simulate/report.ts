/**
 * ===== 쉬운 설명 =====
 * 무엇: 결과를 파일로 남깁니다.
 *   simulations/<실행ID>/sessions.jsonl : 실습 1회 = 1줄, 모든 값(대화 전문·턴별 판단·평가·분석·이상 표시) 그대로
 *   simulations/<실행ID>/sessions.csv   : 실습 1회 = 1행 요약 (엑셀로 열기)
 *   simulations/<실행ID>/turns.csv      : 턴 1개 = 1행 (감정 변화·판단 값·종료 규칙 결과)
 *   simulations/<실행ID>/report.html    : 브라우저로 여는 리포트 (시나리오 × 케이스 표, 이상 목록, 대화별 상세)
 *   simulations/all_sessions.csv, all_turns.csv : 실행할 때마다 아래에 계속 쌓이는 누적 파일
 * 언제: 실습이 하나 끝날 때마다 jsonl 에 바로 추가, 전체가 끝나면(또는 Ctrl+C 로 멈추면) 나머지 파일을 씀.
 * 리뷰 포인트: CSV 는 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM 을 붙입니다.
 * =====================
 */
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { END_REASON_LABELS, EMOTION_LABELS, type EndReason } from "../../packages/shared/src/index.ts";
import { CODE_INFO } from "./checks.ts";
import type { SimCase } from "./cases.ts";
import type { SessionRecord } from "./types.ts";

const BOM = "﻿";
const csvCell = (v: unknown) => {
  if (v == null) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export function appendJsonl(dir: string, rec: SessionRecord) {
  appendFileSync(join(dir, "sessions.jsonl"), JSON.stringify(rec) + "\n", "utf8");
}

const SESSION_HEADER = [
  "run_id", "session_id", "scenario_id", "scenario_version", "scenario_title", "industry", "difficulty", "case_id", "case_label", "repeat",
  "participant_id", "participant_name", "participant_career", "participant_job",
  "end_reason", "ended_by", "learner_turns", "customer_turns", "duration_sec", "time_limit_sec", "max_turns",
  "initial_emotion", "peak_emotion", "final_emotion", "emotion_path", "wrapup_turn", "handoff_status", "handoff_pending_turn", "handoff_target", "handoff_memo",
  "eval_ran", "eval_attempts", "total_score", "grade", "ai_grade", "competency_scores", "checklist_done", "checklist_total",
  "missed_missing", "missed_wrong", "handoff_review_needed", "handoff_review_done", "recommendation", "one_line_summary",
  "dropped_quotes", "quote_text_mismatches",
  "avg_latency_sec", "avg_learner_chars", "talk_ratio", "filler_rate", "cushion_rate", "apology_rate", "empathy_rate", "forbidden_count",
  "expect_pass", "expect_total", "expect_failed", "anomaly_errors", "anomaly_warns", "anomaly_codes",
  "service_tokens_in", "service_tokens_out", "service_cost_usd", "sim_cost_usd", "prompt_version", "customer_model", "classifier_model", "eval_model", "error",
];

function sessionRow(r: SessionRecord): unknown[] {
  const ev = r.evaluation.result;
  const an = r.analytics;
  const failed = r.expectations.filter((e) => !e.passed);
  return [
    r.runId, r.sessionId, r.scenario.id, r.scenario.version, r.scenario.title, r.scenario.industry, r.scenario.difficulty, r.caseId, r.caseLabel, r.repeat,
    r.participant.id, r.participant.name, r.participant.career, r.participant.job,
    r.endReason, r.endedBy, r.messages.filter((m) => m.role === "learner").length, r.messages.filter((m) => m.role === "customer").length, r.durationSec, r.timeLimitSec, r.maxTurns,
    r.initialEmotion, r.peakEmotion, r.finalEmotion, r.emotionPath.join(">"), r.resolvedAtTurn, r.handoff?.status ?? "", r.handoff?.pendingAtTurn ?? "", r.handoff?.target ?? "", r.handoff?.memo ?? "",
    r.evaluation.ran, r.evaluation.attempts.length, ev?.totalScore ?? "", ev?.grade ?? "", r.evaluation.aiGrade ?? "",
    ev ? ev.competencyScores.map((c) => `${c.competency}:${c.score}`).join(" ") : "",
    ev ? ev.checklist.filter((c) => c.done).length : "", ev ? ev.checklist.length : "",
    ev ? ev.missedInfo.filter((m) => m.kind === "missing").length : "", ev ? ev.missedInfo.filter((m) => m.kind === "wrong").length : "",
    ev?.handoffReview.needed ?? "", ev?.handoffReview.done ?? "", ev ? `${ev.recommendation.competency}: ${ev.recommendation.reason}` : "", ev?.oneLineSummary ?? "",
    r.evaluation.droppedGoodPoints + r.evaluation.droppedImprovements, r.evaluation.quoteTextMismatches.length,
    an?.avg_latency_sec ?? "", an?.avg_learner_chars ?? "", an?.talk_ratio ?? "", an?.filler_rate ?? "", an?.cushion_rate ?? "", an?.apology_rate ?? "", an?.empathy_rate ?? "", an?.forbidden_count ?? "",
    r.expectations.length - failed.length, r.expectations.length, failed.map((e) => e.label).join(" | "),
    r.anomalies.filter((a) => a.severity === "error").length, r.anomalies.filter((a) => a.severity === "warn").length, [...new Set(r.anomalies.map((a) => a.code))].join(" "),
    r.usage.text_input_tokens, r.usage.text_output_tokens, r.costUsd.service, r.costUsd.simulator, r.promptVersion, r.models.customer, r.models.classifier, r.models.eval, r.error ?? "",
  ];
}

const TURN_HEADER = [
  "run_id", "session_id", "scenario_title", "case_id", "participant_name", "turn", "learner_seq", "customer_seq", "learner_at_sec", "customer_at_sec",
  "learner_text", "customer_text", "customer_latency_ms", "classifier_latency_ms",
  "prev_emotion", "raw_emotion", "emotion", "emotion_delta", "resolved", "end_conversation", "learner_closing", "handoff_accepted", "classifier_reason",
  "wrapup_directive_active", "learner_turns", "learner_turns_since_wrapup", "outcome_end_reason", "outcome_start_wrapup", "outcome_handoff_pending", "handoff_banner", "classifier_failed", "error", "anomaly_codes",
];

function turnRows(r: SessionRecord): unknown[][] {
  return r.turns.map((t) => [
    r.runId, r.sessionId, r.scenario.title, r.caseId, r.participant.name, t.turn, t.learnerSeq, t.customerSeq, t.learnerAtSec, t.customerAtSec,
    t.learnerText, t.customerText, t.customerLatencyMs, t.classifierLatencyMs,
    t.prevEmotion, t.rawEmotion, t.emotion, t.emotionDelta, t.state?.resolved, t.state?.endConversation, t.state?.learnerClosing, t.state?.handoffAccepted, t.state?.reason,
    t.wrapUpDirectiveActive, t.learnerTurns, t.learnerTurnsSinceWrapUp, t.outcome?.endReason ?? "", t.outcome?.startWrapUp, t.outcome?.handoffPending, t.handoffBannerShown, t.classifierFailed, t.error ?? "",
    r.anomalies.filter((a) => a.turn === t.turn).map((a) => a.code).join(" "),
  ]);
}

export function writeTables(dir: string, rootOut: string, recs: SessionRecord[]) {
  writeFileSync(join(dir, "sessions.csv"), BOM + toCsv(SESSION_HEADER, recs.map(sessionRow)), "utf8");
  writeFileSync(join(dir, "turns.csv"), BOM + toCsv(TURN_HEADER, recs.flatMap(turnRows)), "utf8");
  // 누적 파일: 없으면 머리줄과 함께 만들고, 있으면 아래에 덧붙임
  const appendCum = (file: string, header: string[], rows: unknown[][]) => {
    const p = join(rootOut, file);
    if (!existsSync(p)) writeFileSync(p, BOM + toCsv(header, []), "utf8");
    if (rows.length) appendFileSync(p, rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
  };
  appendCum("all_sessions.csv", SESSION_HEADER, recs.map(sessionRow));
  appendCum("all_turns.csv", TURN_HEADER, recs.flatMap(turnRows));
}

// ---------------- HTML 리포트 ----------------
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const endLabel = (e: string | null, by?: string | null) =>
  by === "harness" && e === "abandoned" ? "끝나지 않음(강제 중단)" : e ? (END_REASON_LABELS[e as EndReason] ?? e) : "-";
const emoLabel = (n: number) => EMOTION_LABELS[n] ?? String(n);
const anchor = (r: SessionRecord) => `s-${r.sessionId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

function spark(path: number[]): string {
  const w = Math.max(60, (path.length - 1) * 18 + 8);
  const pts = path.map((v, i) => `${4 + i * 18},${4 + (4 - v) * 7}`).join(" ");
  const dots = path.map((v, i) => `<circle cx="${4 + i * 18}" cy="${4 + (4 - v) * 7}" r="2.5" fill="${v >= 3 ? "#be123c" : v >= 2 ? "#b45309" : "#15803d"}"/>`).join("");
  return `<svg width="${w}" height="36" role="img" aria-label="감정 흐름 ${path.join(" → ")}"><polyline points="${pts}" fill="none" stroke="#64748b" stroke-width="1.5"/>${dots}</svg>`;
}

export function writeHtml(dir: string, meta: Record<string, unknown>, recs: SessionRecord[], cases: SimCase[]) {
  const scenarios = [...new Map(recs.map((r) => [`${r.scenario.id}@${r.scenario.version}`, r.scenario])).values()];
  const scored = recs.filter((r) => r.evaluation.result);
  const avgScore = scored.length ? Math.round(scored.reduce((s, r) => s + r.evaluation.result!.totalScore, 0) / scored.length) : null;
  const expTotal = recs.reduce((s, r) => s + r.expectations.length, 0);
  const expPass = recs.reduce((s, r) => s + r.expectations.filter((e) => e.passed).length, 0);
  const withErr = recs.filter((r) => r.anomalies.some((a) => a.severity === "error")).length;
  const endKey = (r: SessionRecord) => endLabel(r.endReason, r.endedBy);
  const endDist = Object.entries(recs.reduce<Record<string, number>>((m, r) => ((m[endKey(r)] = (m[endKey(r)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const cost = recs.reduce((s, r) => s + r.costUsd.service + r.costUsd.simulator, 0);

  // 이상 코드별 집계
  const byCode = new Map<string, SessionRecord[]>();
  for (const r of recs) for (const code of new Set(r.anomalies.map((a) => a.code))) byCode.set(code, [...(byCode.get(code) ?? []), r]);
  const codeRows = [...byCode.entries()]
    .sort((a, b) => sevRank(CODE_INFO[a[0]]?.severity) - sevRank(CODE_INFO[b[0]]?.severity) || b[1].length - a[1].length)
    .map(([code, rs]) => {
      const info = CODE_INFO[code];
      return `<tr><td><span class="sev ${info?.severity ?? "warn"}">${esc(info?.severity ?? "warn")}</span></td><td><b>${esc(info?.label ?? code)}</b><div class="mute">${esc(code)}</div></td><td class="num">${rs.length}</td><td>${rs
        .map((r) => `<a href="#${anchor(r)}">${esc(r.scenario.title.slice(0, 8))}·${esc(r.caseId.slice(0, 3))}</a>`)
        .join(" ")}</td><td class="mute">${esc(info?.hint ?? "")}</td></tr>`;
    })
    .join("");

  // 시나리오 × 케이스 표
  const usedCases = cases.filter((c) => recs.some((r) => r.caseId === c.id));
  const matrix = `<table class="matrix"><thead><tr><th>시나리오 \\ 케이스</th>${usedCases
    .map((c) => `<th title="${esc(c.description)}"><div>${esc(c.id.slice(0, 3))}</div><div class="mute">${esc(c.label)}</div></th>`)
    .join("")}</tr></thead><tbody>${scenarios
    .map(
      (s) =>
        `<tr><th class="rowh">${esc(s.title)}<div class="mute">v${s.version} · ${esc(s.difficulty)}</div></th>${usedCases
          .map((c) => {
            const rs = recs.filter((r) => r.scenario.id === s.id && r.scenario.version === s.version && r.caseId === c.id);
            if (!rs.length) return "<td></td>";
            return `<td>${rs
              .map((r) => {
                const fails = r.expectations.filter((e) => !e.passed).length;
                const errs = r.anomalies.filter((a) => a.severity === "error").length;
                const warns = r.anomalies.filter((a) => a.severity === "warn").length;
                const cls = errs || fails ? "bad" : warns ? "warnc" : "good";
                return `<a class="cell ${cls}" href="#${anchor(r)}"><div>${esc(endLabel(r.endReason, r.endedBy))}</div><div class="big">${r.evaluation.result ? `${r.evaluation.result.totalScore}점` : "-"}</div><div class="mute">${esc(r.participant.name)} · ${r.turns.length}턴</div><div>${fails ? `<span class="pill red">기대 ✗${fails}</span>` : `<span class="pill green">기대 ✓</span>`}${errs ? `<span class="pill red">오류 ${errs}</span>` : ""}${warns ? `<span class="pill amber">주의 ${warns}</span>` : ""}</div></a>`;
              })
              .join("")}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody></table>`;

  const expFails = recs.flatMap((r) => r.expectations.filter((e) => !e.passed).map((e) => ({ r, e })));
  const expTable = expFails.length
    ? `<table><thead><tr><th>케이스</th><th>시나리오</th><th>기대 결과</th><th>실제</th></tr></thead><tbody>${expFails
        .map(({ r, e }) => `<tr><td>${esc(r.caseId)} ${esc(r.caseLabel)}</td><td><a href="#${anchor(r)}">${esc(r.scenario.title)}</a></td><td>${esc(e.label)}</td><td>${esc(e.detail)}</td></tr>`)
        .join("")}</tbody></table>`
    : `<p>모든 기대 결과를 통과했습니다.</p>`;

  const details = recs.map((r) => sessionDetail(r)).join("");

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>시뮬레이션 리포트 ${esc(meta.runId)}</title>
<style>
body{font-family:'Pretendard','Noto Sans KR',system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a;font-size:14px}
main{max-width:1400px;margin:0 auto;padding:28px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 10px}
.mute{color:#475569;font-size:12px}.num{text-align:right}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.kpi b{display:block;font-size:22px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}th{background:#f8fafc;font-weight:600;color:#334155}
.wrap{overflow-x:auto}
.matrix td{padding:4px;min-width:120px}.rowh{min-width:150px}
.cell{display:block;border-radius:8px;padding:6px 8px;margin:2px 0;text-decoration:none;color:inherit;border:1px solid #e2e8f0}
.cell.good{background:#f0fdf4;border-color:#bbf7d0}.cell.warnc{background:#fffbeb;border-color:#fde68a}.cell.bad{background:#fff1f2;border-color:#fecdd3}
.big{font-size:16px;font-weight:700}
.pill{display:inline-block;border-radius:999px;padding:1px 7px;font-size:11px;margin:2px 3px 0 0}
.green{background:#dcfce7;color:#166534}.red{background:#ffe4e6;color:#9f1239}.amber{background:#fef3c7;color:#92400e}.gray{background:#f1f5f9;color:#334155}
.sev{display:inline-block;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700}.sev.error{background:#ffe4e6;color:#9f1239}.sev.warn{background:#fef3c7;color:#92400e}.sev.info{background:#e0f2fe;color:#075985}
details.s{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin:10px 0}details.s>summary{cursor:pointer;padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
details.s .body{padding:0 14px 14px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.box{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff}
.turns td{font-size:13px}.turns .l{background:#eff6ff}.turns .c{background:#fff}
.flag{color:#9f1239;font-weight:600}
input[type=search]{padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;min-width:280px}
</style></head><body><main>
<h1>시뮬레이션 리포트</h1>
<div class="mute">실행 ${esc(meta.runId)} · ${esc(meta.startedAt)} ~ ${esc(meta.finishedAt)} · 시나리오 출처 ${esc(meta.source)} · ${meta.mock ? "<b>가짜 AI(mock) 모드: 흐름 점검용, 내용은 의미 없음</b>" : "실제 OpenAI 호출"}</div>
<div class="mute">모델: 고객 ${esc((meta.models as Record<string, string>).customer)} · 판단 ${esc((meta.models as Record<string, string>).classifier)} · 평가 ${esc((meta.models as Record<string, string>).eval)} · 가상 수강생 ${esc((meta.models as Record<string, string>).learnerSim)} · 사고량 ${esc(meta.reasoning ?? "기본")} · 지시문 버전 ${esc(meta.promptVersion)}</div>
<div class="kpis">
<div class="kpi"><span class="mute">실습 수</span><b>${recs.length}</b><span class="mute">시나리오 ${scenarios.length} × 케이스 ${usedCases.length}</span></div>
<div class="kpi"><span class="mute">기대 결과 통과</span><b>${expPass}/${expTotal}</b><span class="mute">${expTotal ? Math.round((expPass / expTotal) * 100) : 0}%</span></div>
<div class="kpi"><span class="mute">오류 표시가 있는 실습</span><b>${withErr}</b></div>
<div class="kpi"><span class="mute">평균 점수</span><b>${avgScore ?? "-"}</b><span class="mute">평가 ${scored.length}건</span></div>
<div class="kpi"><span class="mute">종료 사유</span><div>${endDist.map(([k, v]) => `<span class="pill gray">${esc(k)} ${v}</span>`).join("")}</div></div>
<div class="kpi"><span class="mute">추정 비용 (서비스+시뮬레이터)</span><b>$${cost.toFixed(3)}</b></div>
</div>
<h2>시나리오 × 케이스</h2><p class="mute">칸을 누르면 그 대화의 상세로 이동합니다. 빨강 = 기대 결과 실패 또는 오류, 노랑 = 주의 표시, 초록 = 정상.</p>
<div class="wrap">${matrix}</div>
<h2>자동으로 찾은 이상 (코드별)</h2>${codeRows ? `<div class="wrap"><table><thead><tr><th>등급</th><th>이상</th><th>건수</th><th>해당 실습</th><th>뜻</th></tr></thead><tbody>${codeRows}</tbody></table></div>` : "<p>표시된 이상이 없습니다.</p>"}
<h2>기대 결과 실패</h2><div class="wrap">${expTable}</div>
<h2>실습별 상세</h2>
<p><input type="search" id="q" placeholder="거르기: 시나리오·케이스·참여자·이상 코드" aria-label="실습 거르기"></p>
<div id="list">${details}</div>
</main>
<script>
(function(){var q=document.getElementById('q');if(!q)return;q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();document.querySelectorAll('#list details.s').forEach(function(d){d.style.display=!v||(d.getAttribute('data-key')||'').toLowerCase().indexOf(v)>=0?'':'none';});});
if(location.hash){var el=document.querySelector(location.hash);if(el&&el.tagName==='DETAILS')el.open=true;}
window.addEventListener('hashchange',function(){var el=document.querySelector(location.hash);if(el&&el.tagName==='DETAILS'){el.open=true;}});})();
</script></body></html>`;
  writeFileSync(join(dir, "report.html"), html, "utf8");
}

function sevRank(s?: string) {
  return s === "error" ? 0 : s === "warn" ? 1 : 2;
}

function sessionDetail(r: SessionRecord): string {
  const ev = r.evaluation.result;
  const fails = r.expectations.filter((e) => !e.passed).length;
  const key = [r.scenario.title, r.caseId, r.caseLabel, r.participant.name, r.endReason, ...r.anomalies.map((a) => a.code)].join(" ");
  const turnsHtml = r.turns
    .map((t) => {
      const st = t.state;
      const flags = r.anomalies.filter((a) => a.turn === t.turn).map((a) => CODE_INFO[a.code]?.label ?? a.code);
      const out = t.outcome;
      return `<tr><td class="num">${t.turn}<div class="mute">${t.learnerAtSec}s</div></td>
<td class="l">${esc(t.learnerText)}</td>
<td class="c">${esc(t.customerText ?? "")}${t.customerLatencyMs != null ? `<div class="mute">${(t.customerLatencyMs / 1000).toFixed(1)}초${t.wrapUpDirectiveActive ? " · 마무리 지시 붙음" : ""}</div>` : ""}</td>
<td>${t.prevEmotion}→<b>${t.emotion}</b>${t.emotionDelta ? ` (${t.emotionDelta > 0 ? "+" : ""}${t.emotionDelta})` : ""}<div class="mute">${esc(emoLabel(t.emotion))}${t.rawEmotion != null && t.rawEmotion !== t.emotion ? ` · 원값 ${t.rawEmotion}` : ""}</div></td>
<td>${st ? `${st.resolved ? '<span class="pill green">해결</span>' : ""}${st.endConversation ? '<span class="pill red">고객 종료</span>' : ""}${st.learnerClosing ? '<span class="pill gray">상담원 인사</span>' : ""}${st.handoffAccepted ? '<span class="pill amber">이관 수락</span>' : ""}<div class="mute">${esc(st.reason)}</div>` : '<span class="flag">판단 없음</span>'}</td>
<td>${out ? `${out.endReason ? `<b>종료: ${esc(endLabel(out.endReason))}</b>` : ""}${out.startWrapUp ? '<div class="pill amber">마무리 신호 시작</div>' : ""}${out.handoffPending ? '<div class="pill amber">연결 대기</div>' : ""}` : ""}<div class="mute">수강생 ${t.learnerTurns}턴${t.learnerTurnsSinceWrapUp ? ` · 신호 후 ${t.learnerTurnsSinceWrapUp}` : ""}</div></td>
<td>${t.error ? `<div class="flag">${esc(t.error)}</div>` : ""}${flags.map((f) => `<div class="flag">${esc(f)}</div>`).join("")}</td></tr>`;
    })
    .join("");
  const evHtml = ev
    ? `<div class="box"><b>${ev.totalScore}점 ${esc(ev.grade)}</b>${r.evaluation.aiGrade !== ev.grade ? ` <span class="mute">(AI 등급 ${esc(r.evaluation.aiGrade)})</span>` : ""} <span class="mute">· 평가 ${r.evaluation.attempts.length}회 시도</span>
<p>${esc(ev.oneLineSummary)}</p>
<div class="mute">역량: ${ev.competencyScores.map((c) => `${esc(c.competency)} ${c.score}`).join(" · ")}</div>
<div class="mute">필수 절차: ${ev.checklist.map((c) => `${c.done ? "✓" : "✗"} ${esc(c.label)}`).join(" · ")}</div>
${ev.missedInfo.length ? `<div>빠뜨리거나 틀린 안내: ${ev.missedInfo.map((m) => `<span class="pill ${m.kind === "wrong" ? "red" : "amber"}">${m.kind === "wrong" ? "틀림" : "빠뜨림"}</span>${esc(m.item)}`).join(" ")}</div>` : '<div class="mute">빠뜨리거나 틀린 안내 없음</div>'}
<div class="mute">연결·이관: 필요 ${ev.handoffReview.needed ? "O" : "X"} / 함 ${ev.handoffReview.done ? "O" : "X"} ${esc(ev.handoffReview.comment)}</div>
<div class="mute">잘한 점 ${ev.goodPoints.length} · 개선점 ${ev.improvements.length}${r.evaluation.droppedGoodPoints + r.evaluation.droppedImprovements ? ` · 버린 인용 ${r.evaluation.droppedGoodPoints + r.evaluation.droppedImprovements}` : ""} · 추천: ${esc(ev.recommendation.competency)}</div>
${r.evaluation.attempts.map((a) => (a.problems.length ? `<div class="flag">${a.attempt}차 평가 검증 문제: ${esc(a.problems.join(", "))}</div>` : "")).join("")}</div>`
    : `<div class="box">${esc(r.evaluation.skippedReason ?? r.evaluation.error ?? "평가 없음")}</div>`;
  const an = r.analytics;
  return `<details class="s" id="${anchor(r)}" data-key="${esc(key)}"><summary>
<b>${esc(r.scenario.title)}</b><span class="pill gray">${esc(r.caseId)} ${esc(r.caseLabel)}</span><span>${esc(r.participant.name)} (${esc(r.participant.career)}, ${esc(r.participant.job)})</span>
<span>→ <b>${esc(endLabel(r.endReason, r.endedBy))}</b> <span class="mute">${esc(r.endedBy ?? "")} · ${r.turns.length}턴 · ${r.durationSec ?? "-"}초</span></span>
${spark(r.emotionPath)}
<span class="big">${ev ? `${ev.totalScore}점` : "-"}</span>
${fails ? `<span class="pill red">기대 ✗${fails}</span>` : `<span class="pill green">기대 ✓</span>`}
${r.anomalies.length ? `<span class="pill amber">이상 ${r.anomalies.length}</span>` : ""}
</summary><div class="body">
<div class="grid2">
<div class="box"><b>기대 결과</b>${r.expectations.map((e) => `<div>${e.passed ? "✓" : '<span class="flag">✗</span>'} ${esc(e.label)} <span class="mute">${esc(e.detail)}</span></div>`).join("")}
<b style="display:block;margin-top:8px">이상 표시</b>${r.anomalies.length ? r.anomalies.map((a) => `<div><span class="sev ${a.severity}">${a.severity}</span> ${esc(CODE_INFO[a.code]?.label ?? a.code)}${a.turn ? ` <span class="mute">(${a.turn}턴)</span>` : ""} <span class="mute">${esc(a.message)}</span></div>`).join("") : '<div class="mute">없음</div>'}</div>
${evHtml}
<div class="box"><b>대화 분석</b><div class="mute">평균 응답 ${an?.avg_latency_sec ?? "-"}초 · 평균 발화 ${an?.avg_learner_chars ?? "-"}자 · 말 비중 ${an?.talk_ratio ?? "-"}</div><div class="mute">쿠션어 ${an?.cushion_count ?? "-"} · 사과 ${an?.apology_count ?? "-"} · 공감 ${an?.empathy_count ?? "-"} · 금지 ${an?.forbidden_count ?? "-"} · 필러 ${an?.filler_count ?? "-"}</div>
${r.handoff ? `<div class="mute">연결·이관: ${esc(r.handoff.status)} ${esc(r.handoff.target ?? "")}${r.handoff.memo ? `<br>메모: ${esc(r.handoff.memo)}` : ""}</div>` : ""}
<div class="mute">감정 흐름 ${r.emotionPath.join(" → ")} · 마무리 신호 ${r.resolvedAtTurn ?? "-"}턴 · 비용 $${(r.costUsd.service + r.costUsd.simulator).toFixed(4)}</div></div>
</div>
<div class="wrap" style="margin-top:10px"><table class="turns"><thead><tr><th>턴</th><th>수강생</th><th>AI 고객</th><th>감정</th><th>판단 AI</th><th>종료 규칙</th><th>표시</th></tr></thead><tbody>${turnsHtml}</tbody></table></div>
</div></details>`;
}
