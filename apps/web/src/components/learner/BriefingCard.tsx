/**
 * ===== 쉬운 설명 =====
 * 무엇: 상황 브리핑 내용을 보여주는 카드.
 * 언제: 브리핑 화면, 대화 화면 오른쪽 패널.
 * 리뷰 포인트: 대화 화면에서는 '연결·이관할 수 있는 곳' 옆에 [연결] 버튼이 붙습니다(시작 전 화면에는 없음).
 * =====================
 */
import type { LearnerScenarioView } from "@inhub/shared";

/** 상황 브리핑 (PRD L-12). 대화 화면 사이드 패널에서도 재사용 */
export function BriefingCard({
  view,
  compact,
  onHandoff,
}: {
  view: LearnerScenarioView;
  compact?: boolean;
  /** 대화 화면에서만: '연결할 수 있는 곳' 옆 [연결] 버튼을 누르면 그 대상으로 연결·이관 창을 엶 */
  onHandoff?: (target: string) => void;
}) {
  const b = view.briefing;
  return (
    <div className={compact ? "space-y-4 text-sm" : "space-y-5"}>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-500">상황</h3>
        <p className="leading-relaxed">{b.summary}</p>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-500">고객</h3>
        <p>
          {view.persona.name} ({view.persona.ageGroup}) — {b.customerProfile}
        </p>
      </section>
      <section className="rounded-lg bg-brand-50 p-3">
        <h3 className="mb-1 text-sm font-semibold text-brand-700">응대 목표</h3>
        <p className="text-brand-900">{b.learnerGoal}</p>
      </section>
      {b.facts.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-500">확인된 정보</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {b.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
      {b.policies.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-500">참고 정책</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {b.policies.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
      {(b.handoffTargets ?? []).length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-500">연결·이관할 수 있는 곳</h3>
          <ul className={onHandoff ? "space-y-1" : "list-disc space-y-0.5 pl-5"}>
            {b.handoffTargets.map((f) =>
              onHandoff ? (
                <li key={f} className="flex items-center justify-between gap-2">
                  <span>↪ {f}</span>
                  <button
                    type="button"
                    onClick={() => onHandoff(f)}
                    className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                  >
                    연결
                  </button>
                </li>
              ) : (
                <li key={f}>{f}</li>
              ),
            )}
          </ul>
          <p className="mt-1 text-xs text-slate-500">
            직접 답하기 어려우면 고객에게 연결 이유와 대기 안내를 먼저 말한 뒤, 아래쪽 &lsquo;↪ 연결·이관&rsquo; 버튼으로 넘기세요.
          </p>
        </section>
      )}
    </div>
  );
}
