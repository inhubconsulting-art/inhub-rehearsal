/**
 * ===== 쉬운 설명 =====
 * 무엇: '내 계정' 화면. 내 정보 확인, 비밀번호 변경, 회원 탈퇴.
 * 언제: 상단 오른쪽 내 이름을 누르면.
 * =====================
 */
import { requirePageUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ChangePasswordForm, DeleteAccount } from "@/components/AccountForms";

const ROLE_LABEL = { learner: "수강생", instructor: "강사", admin: "운영 관리자" } as const;

export default async function Account() {
  const u = await requirePageUser();
  const p = u.profile;
  return (
    <AppShell user={u}>
      <PageHeader title="내 계정" />
      <div className="space-y-5">
        <Card>
          <CardTitle>내 정보</CardTitle>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">이름</dt>
            <dd>{p.name}</dd>
            <dt className="text-slate-500">이메일</dt>
            <dd>{p.email ?? "-"}</dd>
            <dt className="text-slate-500">소속</dt>
            <dd>{p.organization ?? "-"}</dd>
            <dt className="text-slate-500">권한</dt>
            <dd>{ROLE_LABEL[p.role]}</dd>
            <dt className="text-slate-500">가입일</dt>
            <dd>{fmtDate(p.created_at)}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">이름·이메일을 바꿔야 하면 강사님이나 운영 관리자에게 요청해 주세요.</p>
        </Card>
        <ChangePasswordForm />
        <DeleteAccount allowed={p.role === "learner"} />
      </div>
    </AppShell>
  );
}
