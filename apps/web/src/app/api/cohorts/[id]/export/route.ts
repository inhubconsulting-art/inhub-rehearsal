/**
 * ===== 쉬운 설명 =====
 * 무엇: Excel 파일 만들기. 시트 3개: 수강생 요약, 시도 이력(역량 점수·총평 포함), 대화 로그.
 * 언제: 내보내기 탭의 '수강생별 점수표'.
 * 리뷰 포인트: Excel 시트·칸 구성이 교육 결과 보고에 필요한 형태인지 확인하세요.
 * =====================
 */
import ExcelJS from "exceljs";
import { COMPETENCIES, COMPETENCY_LABELS, END_REASON_LABELS, type EndReason } from "@inhub/shared";
import { apiError, assertCohortStaff, audit, requireApiUser } from "@/lib/auth";
import { loadCohortDashboard } from "@/lib/cohort-data";
import { adminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** 수강생별 점수표·시도 이력·대화 로그 Excel (PRD A-24) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireApiUser(["admin", "instructor"]);
    await assertCohortStaff(u, id);
    const d = await loadCohortDashboard(id);
    const names = new Map(d.learners.map((l) => [l.userId, l]));
    const titles = new Map(d.scenarios.map((s) => [s.id, s.title]));

    const wb = new ExcelJS.Workbook();
    wb.creator = "인허브 리허설";

    // 1) 수강생 요약
    const s1 = wb.addWorksheet("수강생 요약");
    s1.columns = [
      { header: "이름", key: "name", width: 14 },
      { header: "소속", key: "org", width: 16 },
      { header: "이메일", key: "email", width: 26 },
      ...d.scenarios.map((s) => ({ header: `${s.title} (최고)`, key: `sc_${s.id}`, width: 18 })),
      { header: "평균 점수", key: "avg", width: 10 },
      { header: "시도 수", key: "tries", width: 8 },
    ];
    for (const l of d.learners) {
      const ss = d.sessions.filter((s) => s.userId === l.userId);
      const scored = ss.filter((s) => s.score != null);
      const row: Record<string, unknown> = {
        name: l.name,
        org: l.organization ?? "",
        email: l.email ?? "",
        avg: scored.length ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length) : "",
        tries: ss.length,
      };
      for (const sc of d.scenarios) {
        const best = ss.filter((s) => s.scenarioId === sc.id && s.score != null).map((s) => s.score!);
        row[`sc_${sc.id}`] = best.length ? Math.round(Math.max(...best)) : "";
      }
      s1.addRow(row);
    }

    // 2) 시도 이력 (역량 점수 포함)
    const s2 = wb.addWorksheet("시도 이력");
    s2.columns = [
      { header: "일시", key: "at", width: 18 },
      { header: "이름", key: "name", width: 14 },
      { header: "시나리오", key: "scenario", width: 24 },
      { header: "방식", key: "mode", width: 8 },
      { header: "종료 사유", key: "end", width: 14 },
      { header: "턴 수", key: "turns", width: 8 },
      { header: "등급", key: "grade", width: 6 },
      { header: "점수", key: "score", width: 8 },
      ...COMPETENCIES.map((c) => ({ header: COMPETENCY_LABELS[c], key: `c_${c}`, width: 12 })),
      { header: "총평", key: "summary", width: 50 },
      { header: "잘한 점", key: "good", width: 50 },
      { header: "개선할 점", key: "improve", width: 50 },
    ];
    for (const s of d.sessions) {
      const r = d.results.get(s.id);
      const row: Record<string, unknown> = {
        at: new Date(s.startedAt).toLocaleString("ko-KR"),
        name: names.get(s.userId)?.name ?? "",
        scenario: titles.get(s.scenarioId) ?? "",
        mode: s.mode === "voice" ? "음성" : "텍스트",
        end: s.status === "active" ? "진행 중" : END_REASON_LABELS[s.endReason as EndReason] ?? "",
        turns: s.turnCount,
        grade: s.grade ?? "",
        score: s.score != null ? Math.round(s.score) : "",
        summary: r?.oneLineSummary ?? "",
        good: r?.goodPoints.map((g) => g.reason).join("\n") ?? "",
        improve: r?.improvements.map((g) => `${g.problem} → ${g.betterExample}`).join("\n") ?? "",
      };
      for (const c of r?.competencyScores ?? []) row[`c_${c.competency}`] = Math.round(c.score);
      s2.addRow(row);
    }

    // 3) 대화 로그
    const s3 = wb.addWorksheet("대화 로그");
    s3.columns = [
      { header: "대화 ID", key: "sid", width: 10 },
      { header: "이름", key: "name", width: 14 },
      { header: "시나리오", key: "scenario", width: 24 },
      { header: "순번", key: "seq", width: 6 },
      { header: "화자", key: "role", width: 8 },
      { header: "내용", key: "content", width: 80 },
    ];
    const ids = d.sessions.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await adminClient()
        .from("messages")
        .select("session_id, seq, role, content")
        .in("session_id", ids.slice(i, i + 100))
        .order("session_id")
        .order("seq");
      for (const m of (data ?? []) as { session_id: string; seq: number; role: string; content: string }[]) {
        const s = d.sessions.find((x) => x.id === m.session_id)!;
        s3.addRow({
          sid: m.session_id.slice(0, 8),
          name: names.get(s.userId)?.name ?? "",
          scenario: titles.get(s.scenarioId) ?? "",
          seq: m.seq,
          role: m.role === "learner" ? "상담원" : "고객",
          content: m.content,
        });
      }
    }

    for (const ws of [s1, s2, s3]) {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    }

    const buf = await wb.xlsx.writeBuffer();
    await audit(u.id, "cohort_export", id);
    const filename = encodeURIComponent(`${d.cohort.title}_결과.xlsx`);
    return new Response(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
