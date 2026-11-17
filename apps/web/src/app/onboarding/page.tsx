/**
 * ===== 쉬운 설명 =====
 * 무엇: '프로필 완성' 화면. 수강생이 처음 로그인했을 때(Google 가입 포함) 소속·업종·직무·경력을 한 번 입력합니다.
 * 언제: 프로필이 비어 있는 수강생이 어떤 화면에 들어가든, 문지기(middleware)가 이 화면으로 먼저 보냅니다.
 * 리뷰 포인트:
 *  - 이미 완성했거나 강사·관리자면 이 화면을 건너뛰고 원래 가려던 곳으로 보냅니다.
 *  - 입력한 정보는 교육 효과 분석(그룹별 통계)에 쓰인다고 안내합니다(개인정보처리방침과 같은 내용).
 * =====================
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { LogoutButton } from "@/components/LogoutButton";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await requirePageUser(undefined, { allowIncompleteProfile: true });
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  if (u.profile.profile_completed_at || u.profile.role !== "learner") redirect(next);

  return (
    <div className="flex min-h-screen justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-brand-600">인허브 리허설</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">프로필을 완성해 주세요</h1>
            <p className="mt-1 text-sm text-slate-500">처음 한 번만 입력하면 돼요. 30초면 끝나요.</p>
          </div>
          <LogoutButton />
        </div>
        <Card>
          <ProfileForm
            mode="onboarding"
            next={next}
            initial={{
              name: u.profile.name,
              organization: u.profile.organization,
              department: u.profile.department,
              industry: u.profile.industry,
              job_id: u.profile.job_id,
              job_custom: u.profile.job_custom,
              career: u.profile.career,
            }}
          />
        </Card>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          입력한 정보는 실습 운영과 교육 효과 분석(직무·경력별 통계)에 쓰이며, &lsquo;내 계정&rsquo;에서 언제든 고칠 수 있어요.{" "}
          <Link href="/privacy" target="_blank" className="underline">
            개인정보처리방침
          </Link>
        </p>
      </div>
    </div>
  );
}
