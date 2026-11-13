"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 연습 기록' 대시보드의 차트 2종.
 *  - CompareRadar: 역량별 내 평균 vs 같은 교육 차수 평균
 *  - ScenarioBars: 시나리오별 최고 점수와 최근 점수
 * =====================
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function CompareRadar({ data }: { data: { label: string; mine: number; cohort: number | null }[] }) {
  const hasCohort = data.some((d) => d.cohort != null);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {hasCohort && (
            <Radar name="차수 평균" dataKey="cohort" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} isAnimationActive={false} />
          )}
          <Radar name="나" dataKey="mine" stroke="#2f6fed" fill="#2f6fed" fillOpacity={0.3} isAnimationActive={false} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => (v == null ? "-" : `${v}점`)} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScenarioBars({ data }: { data: { title: string; best: number | null; latest: number | null }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 56 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="title" width={140} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => (v == null ? "-" : `${v}점`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="최고 점수" dataKey="best" fill="#2f6fed" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          <Bar name="최근 점수" dataKey="latest" fill="#94a3b8" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
