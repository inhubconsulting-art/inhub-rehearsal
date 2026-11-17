"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 직무 선택기. 왼쪽에서 대분류(예: 고객상담·TM)를 고르면 오른쪽에 세부 직무가 나오고, 하나를 누르면 선택됩니다.
 *      위쪽 검색칸에 '민원', '매장'처럼 치면 모든 분류에서 맞는 직무를 바로 찾아 줍니다.
 * 언제: '프로필 완성' 화면과 '내 계정' 프로필 수정에서.
 * 리뷰 포인트: 목록 내용은 packages/shared/src/profile.ts 의 JOB_CATEGORIES 에서 고칩니다.
 * =====================
 */
import { useMemo, useState } from "react";
import clsx from "clsx";
import { CUSTOM_JOB_ID, findJob, JOB_CATEGORIES } from "@inhub/shared";
import { Input } from "@/components/ui";

export function JobPicker({
  jobId,
  jobCustom,
  onChange,
}: {
  jobId: string | null;
  jobCustom: string;
  onChange: (jobId: string | null, jobCustom: string) => void;
}) {
  const selected = findJob(jobId);
  const [activeCat, setActiveCat] = useState<string>(selected?.category.id ?? JOB_CATEGORIES[0].id);
  const [query, setQuery] = useState("");

  const q = query.trim().replace(/\s/g, "");
  // 쉬운 설명: 띄어쓰기를 무시하고 직무 이름이나 대분류 이름에 검색어가 들어 있으면 보여 줍니다.
  const results = useMemo(() => {
    if (!q) return [];
    const norm = (s: string) => s.replace(/\s/g, "");
    return JOB_CATEGORIES.flatMap((c) =>
      c.jobs
        .filter((j) => !j.hidden && (norm(j.label).includes(q) || norm(c.label).includes(q)))
        .map((j) => ({ category: c, job: j })),
    );
  }, [q]);

  const category = JOB_CATEGORIES.find((c) => c.id === activeCat) ?? JOB_CATEGORIES[0];

  function pick(id: string) {
    onChange(id, id === CUSTOM_JOB_ID ? jobCustom : "");
    const f = findJob(id);
    if (f) setActiveCat(f.category.id);
    setQuery("");
  }

  const chip = (id: string, label: string, sub?: string) => {
    const on = id === jobId;
    return (
      <button
        key={id}
        type="button"
        onClick={() => pick(id)}
        aria-pressed={on}
        className={clsx(
          "rounded-full border px-3 py-1.5 text-sm transition",
          on ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
        )}
      >
        {label}
        {sub && <span className={clsx("ml-1 text-xs", on ? "text-white/80" : "text-slate-400")}>· {sub}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
            🔍
          </span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="직무 검색 (예: 상담, 매장, 민원, 보험)"
            className="pl-9"
            aria-label="직무 검색"
          />
        </div>
        {jobId && (
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => onChange(null, "")}>
            선택 초기화 ↺
          </button>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span className="font-medium">선택:</span>
          <span>
            {selected.category.label} &gt; {selected.job.label}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {q ? (
          <div className="p-4">
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">
                &lsquo;{query}&rsquo;에 맞는 직무가 없어요. 비슷한 말로 검색하거나 <b>기타 → 기타 (직접 입력)</b>을 골라 주세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">{results.map((r) => chip(r.job.id, r.job.label, r.category.label))}</div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-[11rem_1fr]">
            {/* 대분류: 휴대폰에서는 위쪽에 가로로, 넓은 화면에서는 왼쪽에 세로로 */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2 md:block md:max-h-80 md:overflow-y-auto md:border-r md:border-b-0 md:p-1">
              {JOB_CATEGORIES.map((c) => {
                const active = c.id === category.id;
                const hasPick = selected?.category.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    className={clsx(
                      "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm md:w-full",
                      active ? "bg-white font-semibold text-brand-600 shadow-sm" : "text-slate-600 hover:bg-white",
                    )}
                  >
                    <span>{c.label}</span>
                    {hasPick ? <span className="h-2 w-2 rounded-full bg-brand-500" aria-label="선택됨" /> : active && <span className="hidden md:inline">›</span>}
                  </button>
                );
              })}
            </div>
            {/* 세부 직무 */}
            <div className="p-4">
              <p className="mb-3 text-xs font-medium text-slate-500">{category.label}</p>
              <div className="flex flex-wrap gap-2">{category.jobs.filter((j) => !j.hidden || j.id === jobId).map((j) => chip(j.id, j.label))}</div>
            </div>
          </div>
        )}
      </div>

      {jobId === CUSTOM_JOB_ID && (
        <Input
          value={jobCustom}
          onChange={(e) => onChange(jobId, e.target.value)}
          placeholder="직무를 직접 입력해 주세요 (예: 렌터카 카운터)"
          maxLength={40}
          aria-label="직무 직접 입력"
        />
      )}
    </div>
  );
}
