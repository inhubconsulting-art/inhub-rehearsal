"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 점수 추이 꺾은선 그래프.
 * 언제: 내 연습 기록, 강사의 수강생 상세.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ScoreTrend({ data }: { data: { x: number; score: number; label: string }[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} width={32} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v}점`, "점수"]}
            labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ""}
          />
          <Line type="monotone" dataKey="score" stroke="#2f6fed" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
