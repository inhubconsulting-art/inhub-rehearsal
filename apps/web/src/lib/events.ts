/**
 * ===== 쉬운 설명 =====
 * 무엇: 행동 기록(learner_events)을 저장하는 서버 도우미와, 브라우저 정보(기기·운영체제·브라우저)를 알아내는 함수.
 * 언제: 접속·로그인·리포트 열람·평가 동의·현실감 점수를 기록할 때.
 * 리뷰 포인트:
 *  - 기록은 '덤'이라 실패해도 화면 동작에는 영향을 주지 않습니다(오류를 삼킴).
 *  - 브라우저 정보는 전체 문자열(User-Agent)을 저장하지 않고 '휴대폰/태블릿/PC', 운영체제, 브라우저 이름만 남깁니다.
 * =====================
 */
import "server-only";
import type { EventType } from "@inhub/shared";
import { adminClient } from "@/lib/supabase/admin";

export interface DeviceInfo {
  device: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
}

/** User-Agent 문자열에서 기기 종류·운영체제·브라우저 이름만 뽑기 */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const tablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(s) || (/Macintosh/.test(s) && /Mobile\//.test(s));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(s);
  const os = /Windows/.test(s)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(s)
      ? "iOS"
      : /Android/.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/.test(s)
          ? "macOS"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Linux/.test(s)
              ? "Linux"
              : "기타";
  const browser = /KAKAOTALK/i.test(s)
    ? "카카오톡 인앱"
    : /NAVER/i.test(s)
      ? "네이버 앱"
      : /SamsungBrowser/.test(s)
        ? "삼성 인터넷"
        : /Edg\//.test(s)
          ? "Edge"
          : /Whale/.test(s)
            ? "Whale"
            : /Chrome\/|CriOS/.test(s)
              ? "Chrome"
              : /Firefox|FxiOS/.test(s)
                ? "Firefox"
                : /Safari/.test(s)
                  ? "Safari"
                  : "기타";
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", os, browser };
}

/** 행동 기록 1줄 저장 (실패해도 조용히 넘어감) */
export async function recordEvent(e: {
  userId: string;
  type: EventType;
  sessionId?: string | null;
  cohortId?: string | null;
  props?: Record<string, unknown>;
}) {
  try {
    const { error } = await adminClient()
      .from("learner_events")
      .insert({ user_id: e.userId, type: e.type, session_id: e.sessionId ?? null, cohort_id: e.cohortId ?? null, props: e.props ?? {} });
    if (error) console.warn("[events] not saved:", e.type, error.message);
  } catch (err) {
    console.warn("[events] not saved:", e.type, err);
  }
}

/** 이 수강생이 이 실습에 남긴 마지막 평가 동의(👍/👎)·현실감 점수 (리포트 화면 처음 값) */
export async function loadSessionFeedback(userId: string, sessionId: string) {
  const { data } = await adminClient()
    .from("learner_events")
    .select("type, props, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .in("type", ["report_feedback", "realism_rating"])
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as { type: string; props: Record<string, unknown> }[];
  const fb = rows.find((r) => r.type === "report_feedback")?.props;
  const rr = rows.find((r) => r.type === "realism_rating")?.props;
  return {
    agree: typeof fb?.agree === "boolean" ? (fb.agree as boolean) : null,
    realism: typeof rr?.score === "number" ? (rr.score as number) : null,
  };
}
