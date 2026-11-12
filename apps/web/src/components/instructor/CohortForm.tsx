"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 교육 차수 만들기 양식: 기본 정보, 대화 방식, 제한 시간, 비용 상한, 순서 해금, 시나리오 선택·순서·필수 여부.
 * 언제: 새 교육 차수를 만들 때(PRD A-01).
 * 리뷰 포인트: 교육 준비에 필요한 항목이 빠짐없이 있는지, 용어가 현장과 맞는지 확인하세요.
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY_LABELS, INDUSTRY_LABELS, SCENARIO_TYPE_LABELS } from "@inhub/shared";
import { Button, Card, CardTitle, ErrorText, Field, Input, Select } from "@/components/ui";

type Scen = { id: string; title: string; industry: string; type: string; difficulty: string };

export function CohortForm({
  scenarios,
  instructors,
  isAdmin,
  selfId,
}: {
  scenarios: Scen[];
  instructors: { id: string; name: string }[];
  isAdmin: boolean;
  selfId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [instructorId, setInstructorId] = useState(selfId);
  const [voice, setVoice] = useState(true);
  const [text, setText] = useState(true);
  const [timeLimitMin, setTimeLimitMin] = useState("");
  const [sequential, setSequential] = useState(false);
  const [budget, setBudget] = useState("");
  const [picked, setPicked] = useState<{ scenarioId: string; required: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setPicked((p) => (p.some((x) => x.scenarioId === id) ? p.filter((x) => x.scenarioId !== id) : [...p, { scenarioId: id, required: true }]));
  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const n = [...p];
      const j = i + d;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const allowedModes = [voice && "voice", text && "text"].filter(Boolean);
    const res = await fetch("/api/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        courseName,
        clientName,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        instructorId: isAdmin ? instructorId : null,
        allowedModes,
        timeLimitSec: timeLimitMin ? Number(timeLimitMin) * 60 : null,
        sequential,
        budgetUsd: budget ? Number(budget) : null,
        scenarios: picked,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    router.push(`/instructor/cohorts/${json.cohortId}`);
  }

  const byId = new Map(scenarios.map((s) => [s.id, s]));
  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardTitle>기본 정보</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="차수 이름">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 11월 3주차 CS 심화 1반" required />
          </Field>
          <Field label="과정명">
            <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          </Field>
          <Field label="교육 의뢰 고객사">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>
          <Field label="교육 일시">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          {isAdmin && (
            <Field label="담당 강사">
              <Select value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>실습 설정</CardTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="대화 방식">
            <div className="flex gap-4 pt-2 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> 음성
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> 텍스트
              </label>
            </div>
          </Field>
          <Field label="대화 제한 시간(분)" hint="비우면 시나리오 기본값">
            <Input type="number" min={1} max={60} value={timeLimitMin} onChange={(e) => setTimeLimitMin(e.target.value)} />
          </Field>
          <Field label="API 비용 상한(USD)" hint="사용량 화면에서 경고 기준">
            <Input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} />
          순서대로 해금 (필수 시나리오를 완료해야 다음 시나리오가 열림)
        </label>
      </Card>

      <Card>
        <CardTitle>시나리오 선택</CardTitle>
        <div className="grid gap-2 md:grid-cols-2">
          {scenarios.map((s) => {
            const on = picked.some((p) => p.scenarioId === s.id);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`rounded-lg border p-3 text-left text-sm ${on ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-slate-500">
                  {INDUSTRY_LABELS[s.industry as keyof typeof INDUSTRY_LABELS]} ·{" "}
                  {SCENARIO_TYPE_LABELS[s.type as keyof typeof SCENARIO_TYPE_LABELS]} · 난이도{" "}
                  {DIFFICULTY_LABELS[s.difficulty as keyof typeof DIFFICULTY_LABELS]}
                </div>
              </button>
            );
          })}
        </div>
        {picked.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-600">진행 순서</h3>
            <ol className="space-y-1.5">
              {picked.map((p, i) => (
                <li key={p.scenarioId} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="w-5 text-slate-400">{i + 1}</span>
                  <span className="flex-1">{byId.get(p.scenarioId)?.title}</span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={p.required}
                      onChange={(e) =>
                        setPicked((all) => all.map((x) => (x.scenarioId === p.scenarioId ? { ...x, required: e.target.checked } : x)))
                      }
                    />
                    필수
                  </label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy || picked.length === 0 || (!voice && !text)}>
          {busy ? "저장 중…" : "교육 차수 만들기"}
        </Button>
      </div>
    </form>
  );
}
