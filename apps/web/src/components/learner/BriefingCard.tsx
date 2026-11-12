/**
 * ===== 쉬운 설명 =====
 * 무엇: 상황 브리핑 내용을 보여주는 카드.
 * 언제: 브리핑 화면, 대화 화면 오른쪽 패널.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import type { LearnerScenarioView } from "@inhub/shared";

/** 상황 브리핑 (PRD L-12). 대화 화면 사이드 패널에서도 재사용 */
export function BriefingCard({ view, compact }: { view: LearnerScenarioView; compact?: boolean }) {
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
    </div>
  );
}
