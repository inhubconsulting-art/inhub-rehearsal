"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 편집기. 기본 정보 → 수강생 브리핑 → AI 고객 페르소나 → 대화 전개 규칙 → 평가 루브릭 → 모범 응대 순서의
 *     양식과, 아래쪽 저장·테스트·복제·공개 버튼.
 * 언제: 관리자가 시나리오를 만들거나 고칠 때.
 * 리뷰 포인트: 운영 관리자가 코드 없이 시나리오를 만들 수 있을 만큼 항목 이름과 설명이 이해하기 쉬운지 확인하세요(PRD 5장).
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  EMOTION_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
  SCENARIO_TYPES,
  SCENARIO_TYPE_LABELS,
  type ScenarioContent,
} from "@inhub/shared";
import { Button, Card, CardTitle, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

const VOICES = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

/** 시나리오 편집기 (PRD 5.1 템플릿, S-01 버전 저장, S-02 테스트 플레이) */
export function ScenarioEditor({
  initial,
  scenarioId,
  status,
}: {
  initial: ScenarioContent;
  scenarioId?: string;
  status?: "draft" | "published" | "archived";
}) {
  const router = useRouter();
  const [c, setC] = useState<ScenarioContent>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ScenarioContent>(k: K, v: ScenarioContent[K]) => setC((p) => ({ ...p, [k]: v }));
  const setB = <K extends keyof ScenarioContent["briefing"]>(k: K, v: ScenarioContent["briefing"][K]) =>
    setC((p) => ({ ...p, briefing: { ...p.briefing, [k]: v } }));
  const setP = <K extends keyof ScenarioContent["persona"]>(k: K, v: ScenarioContent["persona"][K]) =>
    setC((p) => ({ ...p, persona: { ...p.persona, [k]: v } }));
  const setD = <K extends keyof ScenarioContent["dynamics"]>(k: K, v: string[]) =>
    setC((p) => ({ ...p, dynamics: { ...p.dynamics, [k]: v } }));

  function cleaned(): ScenarioContent {
    const nonEmpty = (a: string[]) => a.map((s) => s.trim()).filter(Boolean);
    return {
      ...c,
      briefing: { ...c.briefing, facts: nonEmpty(c.briefing.facts), policies: nonEmpty(c.briefing.policies) },
      customerKnowledge: nonEmpty(c.customerKnowledge),
      dynamics: {
        escalateWhen: nonEmpty(c.dynamics.escalateWhen),
        calmWhen: nonEmpty(c.dynamics.calmWhen),
        resolveWhen: nonEmpty(c.dynamics.resolveWhen),
        hangupWhen: nonEmpty(c.dynamics.hangupWhen),
      },
      rubric: {
        items: c.rubric.items.map((r, i) => ({ ...r, id: r.id || `r${i + 1}` })),
        requiredSteps: c.rubric.requiredSteps.filter((s) => s.label.trim()).map((s, i) => ({ id: `s${i + 1}`, label: s.label.trim() })),
      },
      modelAnswers: c.modelAnswers.filter((m) => m.example.trim()),
    };
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    const res = await fetch(scenarioId ? `/api/scenarios/${scenarioId}` : "/api/scenarios", {
      method: scenarioId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleaned()),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    if (!scenarioId) return router.push(`/admin/scenarios/${json.id}`);
    setSaved(`v${json.version} 으로 저장했습니다.`);
    router.refresh();
  }

  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error);
      return null;
    }
    return json;
  }

  return (
    <div className="space-y-5 pb-24">
      <Card>
        <CardTitle>기본 정보</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="제목">
            <Input value={c.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="업종">
              <Select value={c.industry} onChange={(e) => set("industry", e.target.value as ScenarioContent["industry"])}>
                {INDUSTRIES.map((x) => (
                  <option key={x} value={x}>
                    {INDUSTRY_LABELS[x]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="유형">
              <Select value={c.type} onChange={(e) => set("type", e.target.value as ScenarioContent["type"])}>
                {SCENARIO_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {SCENARIO_TYPE_LABELS[x]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="난이도">
              <Select value={c.difficulty} onChange={(e) => set("difficulty", e.target.value as ScenarioContent["difficulty"])}>
                {DIFFICULTIES.map((x) => (
                  <option key={x} value={x}>
                    {DIFFICULTY_LABELS[x]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="채널">
              <Select value={c.channel} onChange={(e) => set("channel", e.target.value as "phone" | "chat")}>
                <option value="phone">전화</option>
                <option value="chat">채팅</option>
              </Select>
            </Field>
            <Field label="제한 시간(분)">
              <Input type="number" min={1} max={60} value={Math.round(c.timeLimitSec / 60)} onChange={(e) => set("timeLimitSec", Number(e.target.value) * 60)} />
            </Field>
            <Field label="최대 턴">
              <Input type="number" min={2} max={100} value={c.maxTurns} onChange={(e) => set("maxTurns", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={c.showEmotionToLearner} onChange={(e) => set("showEmotionToLearner", e.target.checked)} />
            수강생 화면에 고객 감정 표시
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle>수강생 브리핑 (수강생에게 공개)</CardTitle>
        <div className="space-y-4">
          <Field label="상황 설명">
            <Textarea value={c.briefing.summary} onChange={(e) => setB("summary", e.target.value)} rows={3} />
          </Field>
          <Field label="응대 목표">
            <Textarea value={c.briefing.learnerGoal} onChange={(e) => setB("learnerGoal", e.target.value)} rows={2} />
          </Field>
          <Field label="고객 프로필 (수강생이 아는 정보)">
            <Input value={c.briefing.customerProfile} onChange={(e) => setB("customerProfile", e.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Lines label="확인된 정보 (한 줄에 하나)" value={c.briefing.facts} onChange={(v) => setB("facts", v)} />
            <Lines label="참고 정책 (한 줄에 하나)" value={c.briefing.policies} onChange={(v) => setB("policies", v)} />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>AI 고객 페르소나 (수강생 비공개)</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="이름">
            <Input value={c.persona.name} onChange={(e) => setP("name", e.target.value)} />
          </Field>
          <Field label="연령대">
            <Input value={c.persona.ageGroup} onChange={(e) => setP("ageGroup", e.target.value)} placeholder="예) 40대" />
          </Field>
          <Field label="성격">
            <Textarea value={c.persona.personality} onChange={(e) => setP("personality", e.target.value)} rows={2} />
          </Field>
          <Field label="말투">
            <Textarea value={c.persona.speechStyle} onChange={(e) => setP("speechStyle", e.target.value)} rows={2} />
          </Field>
          <Field label="시작 감정">
            <Select value={c.persona.initialEmotion} onChange={(e) => setP("initialEmotion", Number(e.target.value))}>
              {EMOTION_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {i} · {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="인내심 (1 참을성 없음 ~ 5 매우 너그러움)">
            <Input type="number" min={1} max={5} value={c.persona.patience} onChange={(e) => setP("patience", Number(e.target.value))} />
          </Field>
          <Field label="숨은 동기 (잘 물어보면 드러냄)">
            <Textarea value={c.persona.hiddenMotive} onChange={(e) => setP("hiddenMotive", e.target.value)} rows={2} />
          </Field>
          <Field label="첫 용건 (고객의 첫마디)">
            <Textarea value={c.persona.openingLine} onChange={(e) => setP("openingLine", e.target.value)} rows={2} />
          </Field>
          <Lines label="고객이 아는 사실 (한 줄에 하나)" value={c.customerKnowledge} onChange={(v) => set("customerKnowledge", v)} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="목소리">
              <Select value={c.voice.voice} onChange={(e) => set("voice", { ...c.voice, voice: e.target.value })}>
                {VOICES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="목소리 톤">
              <Input value={c.voice.toneInstruction} onChange={(e) => set("voice", { ...c.voice, toneInstruction: e.target.value })} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>대화 전개 규칙</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Lines label="감정이 올라가는 경우" value={c.dynamics.escalateWhen} onChange={(v) => setD("escalateWhen", v)} />
          <Lines label="감정이 누그러지는 경우" value={c.dynamics.calmWhen} onChange={(v) => setD("calmWhen", v)} />
          <Lines label="만족하고 마무리하는 조건" value={c.dynamics.resolveWhen} onChange={(v) => setD("resolveWhen", v)} />
          <Lines label="화가 나서 끊는 조건" value={c.dynamics.hangupWhen} onChange={(v) => setD("hangupWhen", v)} />
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                set("rubric", {
                  ...c.rubric,
                  items: [...c.rubric.items, { id: `r${c.rubric.items.length + 1}`, competency: "language", title: "", description: "", weight: 1 }],
                })
              }
            >
              항목 추가
            </Button>
          }
        >
          평가 루브릭
        </CardTitle>
        <div className="space-y-3">
          {c.rubric.items.map((r, i) => {
            const upd = (patch: Partial<typeof r>) =>
              set("rubric", { ...c.rubric, items: c.rubric.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[160px_1fr_80px_auto]">
                <Select value={r.competency} onChange={(e) => upd({ competency: e.target.value as typeof r.competency })}>
                  {COMPETENCIES.map((x) => (
                    <option key={x} value={x}>
                      {COMPETENCY_LABELS[x]}
                    </option>
                  ))}
                </Select>
                <div className="space-y-2">
                  <Input value={r.title} placeholder="항목명" onChange={(e) => upd({ title: e.target.value })} />
                  <Textarea value={r.description} placeholder="무엇을 보면 잘한 것인지" rows={2} onChange={(e) => upd({ description: e.target.value })} />
                </div>
                <Field label="가중치">
                  <Input type="number" step={0.5} min={0.5} value={r.weight} onChange={(e) => upd({ weight: Number(e.target.value) })} />
                </Field>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => set("rubric", { ...c.rubric, items: c.rubric.items.filter((_, j) => j !== i) })}
                >
                  삭제
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Lines
            label="필수 절차 체크리스트 (한 줄에 하나)"
            value={c.rubric.requiredSteps.map((s) => s.label)}
            onChange={(v) => set("rubric", { ...c.rubric, requiredSteps: v.map((label, i) => ({ id: `s${i + 1}`, label })) })}
          />
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            <Button size="sm" variant="secondary" onClick={() => set("modelAnswers", [...c.modelAnswers, { stage: "", example: "" }])}>
              예시 추가
            </Button>
          }
        >
          모범 응대 예시 (평가에만 사용)
        </CardTitle>
        <div className="space-y-2">
          {c.modelAnswers.map((m, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
              <Input
                value={m.stage}
                placeholder="단계 (예: 공감)"
                onChange={(e) => set("modelAnswers", c.modelAnswers.map((x, j) => (j === i ? { ...x, stage: e.target.value } : x)))}
              />
              <Textarea
                value={m.example}
                rows={2}
                onChange={(e) => set("modelAnswers", c.modelAnswers.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)))}
              />
              <Button size="sm" variant="ghost" onClick={() => set("modelAnswers", c.modelAnswers.filter((_, j) => j !== i))}>
                삭제
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <ErrorText>{error}</ErrorText>
          {saved && <span className="text-sm text-emerald-600">{saved}</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            {scenarioId && (
              <>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    const j = await act(`/api/scenarios/${scenarioId}/preview`, "POST", { mode: "text" });
                    if (j) router.push(`/learn/session/${j.sessionId}`);
                  }}
                >
                  테스트 (텍스트)
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    const j = await act(`/api/scenarios/${scenarioId}/preview`, "POST", { mode: "voice" });
                    if (j) router.push(`/learn/session/${j.sessionId}`);
                  }}
                >
                  테스트 (음성)
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    const j = await act(`/api/scenarios/${scenarioId}/duplicate`, "POST");
                    if (j) router.push(`/admin/scenarios/${j.id}`);
                  }}
                >
                  복제
                </Button>
                {status !== "published" ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (await act(`/api/scenarios/${scenarioId}`, "PATCH", { status: "published" })) router.refresh();
                    }}
                  >
                    공개하기
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (await act(`/api/scenarios/${scenarioId}`, "PATCH", { status: "archived" })) router.refresh();
                    }}
                  >
                    보관하기
                  </Button>
                )}
              </>
            )}
            <Button onClick={save} disabled={busy}>
              {scenarioId ? "새 버전으로 저장" : "만들기"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label={label}>
      <Textarea value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} rows={Math.max(3, value.length + 1)} />
    </Field>
  );
}
