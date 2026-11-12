"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 화면을 실시간으로 유지합니다: 강사가 실습을 시작·정지하거나 공지를 바꾸면 자동 새로고침, 그리고 강사 대시보드에
 *     '접속 중'으로 보이게 합니다.
 * 언제: 수강생 첫 화면과 대화 화면에 보이지 않게 들어 있습니다.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";

/**
 * 수강생 화면 실시간 연결:
 *  - 차수 상태(시작/일시정지/종료, 공지)가 바뀌면 화면 새로고침
 *  - 강사 대시보드에 '접속 중'으로 보이도록 presence 참여
 */
export function CohortLive({
  cohortId,
  userId,
  name,
  activity,
}: {
  cohortId: string;
  userId: string;
  name: string;
  activity: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    const changes = supabase
      .channel(`cohort-changes:${cohortId}:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cohorts", filter: `id=eq.${cohortId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    const presence = supabase.channel(`cohort-presence:${cohortId}`, { config: { presence: { key: userId } } });
    presence.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await presence.track({ userId, name, activity, at: new Date().toISOString() });
    });
    return () => {
      supabase.removeChannel(changes);
      supabase.removeChannel(presence);
    };
  }, [cohortId, userId, name, activity, router]);
  return null;
}
