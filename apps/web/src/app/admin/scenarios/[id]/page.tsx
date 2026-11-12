/**
 * ===== 쉬운 설명 =====
 * 무엇: 기존 시나리오 편집 화면의 입구.
 * 언제: 시나리오 목록에서 제목을 눌렀을 때.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { notFound } from "next/navigation";
import type { ScenarioRow } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { loadScenarioContent } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { ScenarioEditor } from "@/components/admin/ScenarioEditor";

export default async function EditScenario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin"]);
  const { data } = await adminClient().from("scenarios").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const row = data as ScenarioRow;
  const content = await loadScenarioContent(id, row.current_version);
  const { data: versions } = await adminClient()
    .from("scenario_versions")
    .select("version, created_at")
    .eq("scenario_id", id)
    .order("version", { ascending: false });
  return (
    <AppShell user={u}>
      <PageHeader title={row.title} description={`현재 v${row.current_version} · 버전 ${versions?.length ?? 1}개`} />
      <ScenarioEditor initial={content} scenarioId={id} status={row.status} />
    </AppShell>
  );
}
