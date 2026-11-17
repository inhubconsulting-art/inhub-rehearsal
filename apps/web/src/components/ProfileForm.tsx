"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 프로필 입력칸 묶음 (이름, 소속, 부서, 업종, 직무, 경력) + 저장 버튼.
 * 언제: '프로필 완성' 화면(첫 로그인)과 '내 계정'의 프로필 수정에서 같은 칸을 씁니다.
 * 리뷰 포인트:
 *  - 업종·경력은 버튼으로 고르고, 직무는 대분류→세부 선택기(JobPicker)로 고릅니다. 직접 쓰지 않게 해야 그룹별 분석이 됩니다.
 *  - 저장하면 onboarding 에서는 원래 가려던 화면으로 이동하고, 내 계정에서는 '저장했습니다' 알림을 띄웁니다.
 * =====================
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CAREER_BANDS, CUSTOM_JOB_ID, PROFILE_INDUSTRIES } from "@inhub/shared";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { JobPicker } from "@/components/JobPicker";
import { useToast } from "@/components/Toast";

export interface ProfileFormInitial {
  name: string;
  organization: string | null;
  department: string | null;
  industry: string | null;
  job_id: string | null;
  job_custom: string | null;
  career: string | null;
}

function Required() {
  return <span className="ml-0.5 text-rose-500">*</span>;
}

/** 버튼 여러 개 중 하나를 고르는 칸 */
function Choice({ options, value, onChange }: { options: { id: string; label: string; hidden?: boolean }[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options
        .filter((o) => !o.hidden || o.id === value)
        .map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={o.id === value}
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-sm",
              o.id === value ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {o.label}
          </button>
        ))}
    </div>
  );
}

export function ProfileForm({ initial, mode, next = "/" }: { initial: ProfileFormInitial; mode: "onboarding" | "account"; next?: string }) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [name, setName] = useState(initial.name);
  const [organization, setOrganization] = useState(initial.organization ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [industry, setIndustry] = useState<string | null>(initial.industry);
  const [jobId, setJobId] = useState<string | null>(initial.job_id);
  const [jobCustom, setJobCustom] = useState(initial.job_custom ?? "");
  const [career, setCareer] = useState<string | null>(initial.career);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // 쉬운 설명: 서버에 보내기 전에 빠진 칸을 먼저 알려 줍니다.
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    if (!organization.trim()) return setError("소속(회사·기관)을 입력해 주세요.");
    if (!industry) return setError("업종을 골라 주세요.");
    if (!jobId) return setError("직무를 골라 주세요.");
    if (jobId === CUSTOM_JOB_ID && !jobCustom.trim()) return setError("직무를 직접 입력해 주세요.");
    if (!career) return setError("경력을 골라 주세요.");

    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        organization: organization.trim(),
        department: department.trim() || null,
        industry,
        jobId,
        jobCustom: jobId === CUSTOM_JOB_ID ? jobCustom.trim() : null,
        career,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
      return setError(msg ?? "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    if (mode === "onboarding") {
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } else {
      showToast("프로필을 저장했습니다");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름 *">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
        </Field>
        <Field label="소속 (회사·기관) *">
          <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="예) 인허브은행" maxLength={80} />
        </Field>
        <Field label="부서 (선택)">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="예) 고객지원팀" maxLength={80} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          업종<Required /> <span className="font-normal text-slate-400">· 다니는 회사·기관의 분야</span>
        </p>
        <Choice options={PROFILE_INDUSTRIES} value={industry} onChange={setIndustry} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          직무<Required /> <span className="font-normal text-slate-400">· 지금 하는 일과 가장 가까운 것 하나</span>
        </p>
        <JobPicker
          jobId={jobId}
          jobCustom={jobCustom}
          onChange={(id, custom) => {
            setJobId(id);
            setJobCustom(custom);
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          고객 응대 경력<Required /> <span className="font-normal text-slate-400">· 지금까지 고객을 응대한 기간의 합</span>
        </p>
        <Choice options={CAREER_BANDS} value={career} onChange={setCareer} />
      </div>

      <ErrorText>{error}</ErrorText>
      <div className={mode === "onboarding" ? "" : "flex justify-end"}>
        <Button type="submit" size={mode === "onboarding" ? "lg" : "md"} className={mode === "onboarding" ? "w-full" : undefined} disabled={busy}>
          {busy ? "저장 중…" : mode === "onboarding" ? "저장하고 시작하기" : "프로필 저장"}
        </Button>
      </div>
      {toast}
    </form>
  );
}
