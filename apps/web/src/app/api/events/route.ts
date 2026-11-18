/**
 * ===== 쉬운 설명 =====
 * 무엇: 브라우저가 보내는 행동 기록을 받는 서버 창구 (접속, 로그인, 리포트 열람, 평가 동의 👍/👎, 현실감 점수).
 * 언제: 로그인 직후, 서비스 첫 화면을 열 때, 리포트를 보고 나갈 때, 버튼을 누를 때.
 * 리뷰 포인트:
 *  - 정해진 종류와 모양의 기록만 받습니다(아무 값이나 저장되지 않게).
 *  - 실습과 관련된 기록은 본인 실습일 때만 저장합니다.
 *  - 페이지를 떠날 때 보내는 기록(sendBeacon)도 받을 수 있게 본문을 글자로 읽어 해석합니다.
 * =====================
 */
import { headers } from "next/headers";
import { z } from "zod";
import { EVENT_TYPES } from "@inhub/shared";
import { apiError, HttpError, requireApiUser } from "@/lib/auth";
import { getOwnSession } from "@/lib/domain";
import { parseUserAgent, recordEvent } from "@/lib/events";

const shortText = z.string().trim().max(200);
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(EVENT_TYPES.visit),
    props: z.object({
      path: shortText,
      /** 들어온 경로: qr / link / 그 밖 */
      src: z.enum(["qr", "link"]).nullable().default(null),
      /** 다른 사이트에서 왔다면 그 사이트 주소(도메인만) */
      referrer: shortText.nullable().default(null),
    }),
  }),
  z.object({ type: z.literal(EVENT_TYPES.login), props: z.object({ method: z.enum(["email", "google"]) }) }),
  z.object({
    type: z.literal(EVENT_TYPES.report_view),
    sessionId: z.string().uuid(),
    props: z.object({
      dwell_sec: z.number().min(0).max(4 * 3600),
      max_scroll_pct: z.number().min(0).max(100),
    }),
  }),
  z.object({
    type: z.literal(EVENT_TYPES.report_section_open),
    sessionId: z.string().uuid(),
    props: z.object({ section: z.enum(["transcript"]) }),
  }),
  z.object({
    type: z.literal(EVENT_TYPES.report_feedback),
    sessionId: z.string().uuid(),
    props: z.object({ agree: z.boolean(), comment: z.string().trim().max(300).nullable().default(null) }),
  }),
  z.object({
    type: z.literal(EVENT_TYPES.realism_rating),
    sessionId: z.string().uuid(),
    props: z.object({ score: z.number().int().min(1).max(5) }),
  }),
]);

export async function POST(req: Request) {
  try {
    const u = await requireApiUser();
    let json: unknown = null;
    try {
      json = JSON.parse(await req.text());
    } catch {
      throw new HttpError(400, "잘못된 요청입니다.");
    }
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "잘못된 기록입니다.");
    const ev = parsed.data;

    let sessionId: string | null = null;
    let cohortId: string | null = null;
    if ("sessionId" in ev) {
      const s = await getOwnSession(u, ev.sessionId);
      sessionId = s.id;
      cohortId = s.cohort_id;
    }
    // 접속·로그인 기록에는 기기 종류·운영체제·브라우저를 함께 남깁니다.
    const props: Record<string, unknown> = { ...ev.props };
    if (ev.type === EVENT_TYPES.visit || ev.type === EVENT_TYPES.login) {
      Object.assign(props, parseUserAgent((await headers()).get("user-agent")));
    }
    await recordEvent({ userId: u.id, type: ev.type, sessionId, cohortId, props });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
