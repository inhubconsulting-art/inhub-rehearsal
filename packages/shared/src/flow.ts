/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 종료 규칙. 고객이 말할 때마다 판단 AI의 결과를 보고 '대화를 끝낼지, 마무리 신호를 줄지, 연결 대기로 둘지' 정합니다.
 *      텍스트·음성이 같은 규칙을 씁니다.
 * 언제: AI 고객이 한 번 말하고 상태 판단이 끝난 직후.
 * 리뷰 포인트: 아래 순서가 운영 기준과 맞는지 확인하세요.
 *  1) 고객이 연결·이관을 받아들임 → 끝내지 않고 '연결 대기'로 표시 (수강생이 연결·이관 버튼으로 인계 메모를 남기고 마침)
 *  2) 고객이 마무리 인사를 함 → 종료 (용건에 답을 들었으면 '문제 해결', 아니면 '고객이 대화를 끝냄')
 *  3) 용건에 답이 다 나왔고 상담원이 마무리 인사를 함 → '문제 해결'로 종료
 *  4) 용건에 답이 다 나옴 → 처음이면 '마무리 신호' 시작, 신호 후 수강생이 2번 더 말해도 안 끝나면 '문제 해결'로 자동 종료
 *  5) 최대 턴 수 도달 → 종료
 *  ※ 상담원 안내가 틀리거나 빠져도 고객은 모르므로 대화는 끝날 수 있고, 그 부분은 평가에서 감점됩니다.
 * =====================
 */
import type { CustomerState, EndReason } from "./emotion";

/** 마무리 신호 뒤 수강생이 이만큼 더 말해도 안 끝나면 자동 종료 */
export const WRAP_UP_GRACE_TURNS = 2;

export interface TurnOutcome {
  endReason: EndReason | null;
  /** 이번에 처음 '용건에 답이 다 나옴'이 됨 → resolved_at 기록 + 마무리 신호 */
  startWrapUp: boolean;
  /** 고객이 연결을 받아들이고 기다리는 중으로 표시 */
  handoffPending: boolean;
}

export function decideTurnOutcome(input: {
  state: CustomerState;
  /** 이미 마무리 신호를 준 시각 (없으면 null) */
  resolvedAt: string | null | undefined;
  /** 마무리 신호 이후 수강생 발화 수 */
  learnerTurnsSinceWrapUp: number;
  learnerTurns: number;
  maxTurns: number;
  /** 이미 연결·이관을 마쳤거나 대기 중인지 */
  handoffStatus: "pending" | "done" | null | undefined;
}): TurnOutcome {
  const { state } = input;
  const out: TurnOutcome = { endReason: null, startWrapUp: false, handoffPending: false };

  if (state.handoffAccepted && input.handoffStatus !== "done") {
    out.handoffPending = input.handoffStatus !== "pending";
    return out;
  }
  if (state.endConversation) {
    out.endReason = state.resolved ? "resolved" : "customer_left";
    return out;
  }
  if (state.resolved && state.learnerClosing) {
    out.endReason = "resolved";
    return out;
  }
  if (state.resolved || input.resolvedAt) {
    if (!input.resolvedAt) out.startWrapUp = true;
    else if (input.learnerTurnsSinceWrapUp >= WRAP_UP_GRACE_TURNS) {
      out.endReason = "resolved";
      return out;
    }
  }
  if (input.learnerTurns >= input.maxTurns) out.endReason = "turn_limit";
  return out;
}
