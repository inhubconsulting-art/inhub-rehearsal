/**
 * ===== 쉬운 설명 =====
 * 무엇: 시나리오 목록(상태, 버전, 수정일).
 * 언제: 관리자 메뉴 '시나리오'.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import Link from "next/link";
import { DIFFICULTY_LABELS, INDUSTRY_LABELS, SCENARIO_TYPE_LABELS, type ScenarioRow } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

const STATUS = {
  draft: { label: "초안", tone: "amber" },
  published: { label: "공개", tone: "green" },
  archived: { label: "보관", tone: "slate" },
} as const;

export default async function ScenarioList() {
  const u = await requirePageUser(["admin"]);
  const { data } = await adminClient().from("scenarios").select("*").order("updated_at", { ascending: false });
  const rows = (data ?? []) as ScenarioRow[];
  return (
    <AppShell user={u} wide>
      <PageHeader
        title="시나리오"
        description="저장할 때마다 새 버전이 만들어지고, 이미 교육에 배정된 버전은 바뀌지 않습니다."
        actions={<LinkButton href="/admin/scenarios/new">새 시나리오</LinkButton>}
      />
      {rows.length === 0 ? (
        <EmptyState title="시나리오가 없습니다." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">제목</th>
                <th className="px-4 py-2 font-medium">업종</th>
                <th className="px-4 py-2 font-medium">유형</th>
                <th className="px-4 py-2 font-medium">난이도</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 text-right font-medium">버전</th>
                <th className="px-4 py-2 text-right font-medium">수정일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link className="font-medium text-brand-600 hover:underline" href={`/admin/scenarios/${r.id}`}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{INDUSTRY_LABELS[r.industry as keyof typeof INDUSTRY_LABELS] ?? r.industry}</td>
                  <td className="px-4 py-2">{SCENARIO_TYPE_LABELS[r.type as keyof typeof SCENARIO_TYPE_LABELS] ?? r.type}</td>
                  <td className="px-4 py-2">{DIFFICULTY_LABELS[r.difficulty as keyof typeof DIFFICULTY_LABELS] ?? r.difficulty}</td>
                  <td className="px-4 py-2">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">v{r.current_version}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
