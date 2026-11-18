"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: '연결·이관' 창. 고객을 다른 담당자·부서로 넘길 때 연결할 곳을 고르고, 다음 담당자가 읽을 인계 메모를 씁니다.
 *      '연결하고 실습 마치기'를 누르면 고객이 연결된 것으로 처리되고 실습이 끝나 리포트로 갑니다.
 * 언제: 대화 화면 위쪽 '연결·이관' 버튼, 또는 고객이 연결을 받아들였을 때 뜨는 안내 띠에서.
 * 리뷰 포인트: 실제로 전화를 넘기지는 않습니다. 고객에게 연결 이유·대기 안내를 '말로' 먼저 하고 누르도록 안내합니다.
 *         인계 메모가 다음 담당자가 고객에게 같은 질문을 반복하지 않아도 될 만큼 충실한지 리포트에서 평가합니다.
 * =====================
 */
import { useState } from "react";
import { Button, ErrorText, Input, Select, Textarea } from "@/components/ui";

const CUSTOM = "__custom__";

export function HandoffDialog({
  sessionId,
  targets,
  onClose,
  onDone,
}: {
  sessionId: string;
  targets: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState(targets[0] ?? CUSTOM);
  const [customTarget, setCustomTarget] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalTarget = target === CUSTOM ? customTarget.trim() : target;
    if (!finalTarget) return setError("연결할 곳을 골라 주세요.");
    if (memo.trim().length < 10) return setError("인계 메모를 10자 이상 써 주세요.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: finalTarget, memo: memo.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
      return setError(msg ?? "연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="연결·이관">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold">연결·이관</h2>
          <p className="mt-1 text-sm text-slate-500">
            고객에게 <b>연결하는 이유</b>와 <b>대기·연락 안내</b>를 먼저 말한 뒤 누르세요. 누르면 연결된 것으로 처리되고 실습이 끝나요.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">연결할 곳</span>
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            {targets.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={CUSTOM}>직접 입력</option>
          </Select>
          {target === CUSTOM && (
            <Input
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              placeholder="예) 담당 부서 회신 예약, 상급자 연결"
              maxLength={60}
              aria-label="연결할 곳 직접 입력"
            />
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">다음 담당자에게 남길 인계 메모</span>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder={"고객이 같은 말을 반복하지 않도록 핵심을 남겨 주세요.\n예) 박영숙님(59.4.12), 다음주 목 08:30로 검진 변경 완료. 혈압약·금식 안내함.\n수면 내시경 시 수면제와 혈압약 함께 복용 가능한지, 보호자 동행 필요한지 상담 요청."}
          />
          <span className="block text-xs text-slate-400">고객 정보 · 문의 요약 · 이미 안내한 것 · 요청 사항 · 연락 방법</span>
        </label>

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "연결 중…" : "연결하고 실습 마치기"}
          </Button>
        </div>
      </form>
    </div>
  );
}
