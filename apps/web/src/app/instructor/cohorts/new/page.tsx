/**
 * ===== 쉬운 설명 =====
 * 무엇: 새 교육 차수 만들기 화면의 입구.
 * 언제: '새 교육 차수' 버튼.
 * 리뷰 포인트: 내용은 CohortForm.tsx 에서 보세요.
 * =====================
 */
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { CohortForm } from "@/components/instructor/CohortForm";

export default async function NewCohort() {
  const u = await requirePageUser(["admin", "instructor"]);
  const db = adminClient();
  const [{ data: scenarios }, { data: instructors }] = await Promise.all([
    db.from("scenarios").select("id, title, industry, type, difficulty").eq("status", "published").order("title"),
    u.profile.role === "admin"
      ? db.from("profiles").select("id, name").in("role", ["instructor", "admin"]).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  return (
    <AppShell user={u}>
      <PageHeader title="새 교육 차수" description="저장하면 수강생용 입장 코드와 QR이 만들어집니다." />
      <CohortForm
        scenarios={(scenarios ?? []) as { id: string; title: string; industry: string; type: string; difficulty: string }[]}
        instructors={(instructors ?? []) as { id: string; name: string }[]}
        isAdmin={u.profile.role === "admin"}
        selfId={u.id}
      />
    </AppShell>
  );
}
