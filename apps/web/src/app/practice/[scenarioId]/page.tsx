/**
 * ===== 쉬운 설명 =====
 * 무엇: 개인 연습 브리핑 화면. 상황·고객·응대 목표·정책을 보고, 오른쪽에서 대화 방식을 골라 시작합니다.
 * 언제: 연습하기 → 시나리오 카드의 '브리핑 보고 시작'.
 * 리뷰 포인트: 시작 버튼이 '시작 · 이용권 1회 차감'으로 보이고, 남은 횟수가 없으면 막히는지 확인하세요.
 *         개인 연습에 공개되지 않은 시나리오는 열리지 않습니다.
 * =====================
 */
import { notFound } from "next/navigation";
import { toLearnerView } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { loadScenarioContent } from "@/lib/domain";
import { getPassBalance } from "@/lib/practice";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader } from "@/components/ui";
import { BriefingCard } from "@/components/learner/BriefingCard";
import { StartScenario } from "@/components/learner/StartScenario";

export default async function PracticeBriefing({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const u = await requirePageUser();
  const { data } = await adminClient()
    .from("scenarios")
    .select("current_version, status, practice_public")
    .eq("id", scenarioId)
    .maybeSingle();
  const s = data as { current_version: number; status: string; practice_public: boolean } | null;
  if (!s || s.status !== "published" || !s.practice_public) notFound();
  const [content, balance] = await Promise.all([loadScenarioContent(scenarioId, s.current_version), getPassBalance(u.id)]);
  const view = toLearnerView(content);

  return (
    <AppShell user={u}>
      <PageHeader
        title={view.title}
        description={`개인 연습 · 제한 시간 ${Math.round(view.timeLimitSec / 60)}분 · 최대 ${view.maxTurns}턴`}
      />
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <BriefingCard view={view} />
        </Card>
        <Card className="h-fit">
          <StartScenario scenarioId={scenarioId} allowedModes={["text", "voice"]} channel={view.channel} running practice={{ balance }} />
        </Card>
      </div>
    </AppShell>
  );
}
