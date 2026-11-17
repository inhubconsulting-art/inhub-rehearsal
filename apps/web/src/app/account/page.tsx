/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 계정' 화면. 계정 정보 확인, 프로필(이름·소속·업종·직무·경력) 수정, 비밀번호 변경, 회원 탈퇴.
 * 언제: 상단 오른쪽 내 이름을 누르면.
 * 리뷰 포인트: Google로만 가입한 사람은 비밀번호가 없으므로 비밀번호 변경 칸 대신 'Google 계정으로 로그인 중' 안내를 보여 줍니다.
 * =====================
 */
import { requirePageUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ChangePasswordForm, DeleteAccount } from "@/components/AccountForms";
import { ProfileForm } from "@/components/ProfileForm";

const ROLE_LABEL = { learner: "수강생", instructor: "강사", admin: "운영 관리자" } as const;

export default async function Account() {
  const u = await requirePageUser();
  const p = u.profile;
  // 쉬운 설명: 이 계정이 어떤 방법으로 로그인할 수 있는지 (email = 이메일·비밀번호, google = 구글)
  const {
    data: { user: authUser },
  } = await (await createClient()).auth.getUser();
  const providers: string[] = (authUser?.app_metadata?.providers as string[] | undefined) ?? [authUser?.app_metadata?.provider ?? "email"];
  const hasGoogle = providers.includes("google");
  const hasPassword = providers.includes("email");
  return (
    <AppShell user={u}>
      <PageHeader title="내 계정" />
      <div className="space-y-5">
        <Card>
          <CardTitle>계정 정보</CardTitle>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">이메일</dt>
            <dd>{p.email ?? "-"}</dd>
            <dt className="text-slate-500">권한</dt>
            <dd>{ROLE_LABEL[p.role]}</dd>
            <dt className="text-slate-500">로그인 방법</dt>
            <dd>{[hasPassword && "이메일·비밀번호", hasGoogle && "Google"].filter(Boolean).join(", ") || "-"}</dd>
            <dt className="text-slate-500">가입일</dt>
            <dd>{fmtDate(p.created_at)}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">이메일을 바꿔야 하면 강사님이나 운영 관리자에게 요청해 주세요.</p>
        </Card>
        <div id="profile" className="scroll-mt-20">
          <Card>
            <CardTitle>프로필</CardTitle>
            <p className="mb-4 text-sm text-slate-500">
              이직하거나 직무가 바뀌면 고쳐 주세요. 이미 참여한 교육의 기록은 입장할 때의 정보로 남고, 다음에 참여하는 교육부터 새 정보가 쓰여요.
            </p>
            <ProfileForm
              mode="account"
              initial={{
                name: p.name,
                organization: p.organization,
                department: p.department,
                industry: p.industry,
                job_id: p.job_id,
                job_custom: p.job_custom,
                career: p.career,
              }}
            />
          </Card>
        </div>
        {hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <Card>
            <CardTitle>비밀번호</CardTitle>
            <p className="text-sm text-slate-600">Google 계정으로 로그인하고 있어 따로 비밀번호가 없습니다. 비밀번호는 Google 계정에서 관리해 주세요.</p>
          </Card>
        )}
        <DeleteAccount allowed={p.role === "learner"} />
      </div>
    </AppShell>
  );
}
