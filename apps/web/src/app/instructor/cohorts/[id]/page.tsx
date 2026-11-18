/**
 * ===== 쉬운 설명 =====
 * 무엇: 강사 대시보드 화면의 입구. 데이터와 입장 QR 코드를 준비해 대시보드 본체에 넘깁니다.
 * 언제: 교육 차수 카드를 눌렀을 때.
 * 리뷰 포인트: 내용은 CohortDashboard.tsx 에서 보세요.
 * =====================
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { assertCohortStaff, requirePageUser } from "@/lib/auth";
import { loadCohortDashboard } from "@/lib/cohort-data";
import { AppShell } from "@/components/AppShell";
import { CohortDashboard } from "@/components/instructor/CohortDashboard";

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requirePageUser(["admin", "instructor"]);
  try {
    await assertCohortStaff(u, id);
  } catch {
    redirect("/instructor");
  }
  const d = await loadCohortDashboard(id);
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  // 쉬운 설명: QR과 화면에 적힌 주소에 서로 다른 표시(src)를 붙여, 수강생이 어느 쪽으로 들어왔는지 구분합니다.
  const baseJoinUrl = `${proto}://${host}/learn?code=${d.cohort.join_code}`;
  const joinUrl = `${baseJoinUrl}&src=link`;
  const qrDataUrl = await QRCode.toDataURL(`${baseJoinUrl}&src=qr`, { margin: 1, width: 320 });

  return (
    <AppShell user={u} wide>
      <CohortDashboard
        cohort={d.cohort}
        learners={d.learners}
        sessions={d.sessions}
        scenarios={d.scenarios}
        competencyAvg={d.competencyAvg}
        summary={d.summary}
        joinUrl={joinUrl}
        qrDataUrl={qrDataUrl}
      />
    </AppShell>
  );
}
