"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 리포트의 역량 레이더 차트와 고객 감정 흐름 그래프.
 * 언제: 리포트 화면.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { EMOTION_LABELS } from "@inhub/shared";

export function CompetencyRadar({ data }: { data: { label: string; score: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#2f6fed" fill="#2f6fed" fillOpacity={0.25} isAnimationActive={false} />
          <Tooltip formatter={(v) => [`${v}점`, "점수"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmotionFlow({ data }: { data: { seq: number; emotion: number }[] }) {
  if (data.length < 2) return <p className="text-sm text-slate-500">감정 변화를 그릴 만큼 대화가 길지 않았습니다.</p>;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey="seq" tick={{ fontSize: 11 }} label={{ value: "발화 번호", position: "insideBottomRight", offset: -4, fontSize: 11 }} />
          <YAxis
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            width={64}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => EMOTION_LABELS[v] ?? ""}
          />
          <Tooltip formatter={(v: number) => [EMOTION_LABELS[v], "고객 감정"]} labelFormatter={(l) => `#${l}`} />
          <Line type="monotone" dataKey="emotion" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
