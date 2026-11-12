/**
 * ===== 쉬운 설명 =====
 * 무엇: 사용자 목록과 역할 변경.
 * 언제: 관리자 메뉴 '사용자'.
 * 리뷰 포인트: 새 강사가 오면 여기서 '강사'로 바꿔 줍니다.
 * =====================
 */
import type { ProfileRow } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader } from "@/components/ui";
import { RoleSelect } from "@/components/admin/RoleSelect";

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requirePageUser(["admin"]);
  const { q } = await searchParams;
  let query = adminClient().from("profiles").select("*").order("created_at", { ascending: false }).limit(300);
  const term = (q ?? "").replace(/[,()%*\\]/g, "").trim();
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await query;
  const rows = (data ?? []) as ProfileRow[];
  return (
    <AppShell user={u} wide>
      <PageHeader title="사용자" description="가입한 사용자는 기본적으로 수강생입니다. 강사·관리자 권한은 여기서 부여하세요." />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="이름 또는 이메일 검색" className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </form>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">소속</th>
              <th className="px-4 py-2 font-medium">가입일</th>
              <th className="px-4 py-2 font-medium">역할</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-slate-600">{r.email}</td>
                <td className="px-4 py-2 text-slate-600">{r.organization ?? "-"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(r.created_at).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-2">
                  <RoleSelect userId={r.id} role={r.role} disabled={r.id === u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
