/**
 * ===== 쉬운 설명 =====
 * 무엇: 고객 감정을 5칸 막대로 보여주는 표시기.
 * 언제: 대화 화면(설정 시), 강사의 실시간 열람 화면.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { EMOTION_LABELS } from "@inhub/shared";

const COLORS = ["bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500", "bg-rose-600"];

export function EmotionMeter({ level }: { level: number | null }) {
  const l = level ?? 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>고객 감정</span>
        <span className="font-medium text-slate-700">{EMOTION_LABELS[l]}</span>
      </div>
      <div className="flex gap-1">
        {EMOTION_LABELS.map((_, i) => (
          <div key={i} className={`h-2 flex-1 rounded ${i <= l ? COLORS[l] : "bg-slate-200"}`} />
        ))}
      </div>
    </div>
  );
}
