/**
 * ===== 쉬운 설명 =====
 * 무엇: 실시간 연결(Supabase Realtime) 이름을 안전하게 만드는 도우미입니다.
 * 왜: 같은 이름의 연결이 아직 정리되는 중일 때 다시 만들면, 이미 열린 연결을 돌려받아
 *     "연결이 시작된 뒤에는 듣기 설정을 추가할 수 없다"는 오류로 화면 전체가 멈출 수 있습니다.
 *     (화면을 오가거나 새로고침이 겹칠 때 발생) 그래서 화면마다 겹치지 않는 이름을 붙입니다.
 *     단, '접속 중' 표시(presence)는 모두 같은 이름을 써야 해서 이 도우미를 쓰지 않습니다.
 * =====================
 */
export function uniqueTopic(base: string): string {
  return `${base}:${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * '접속 중' 표시(presence)처럼 이름을 공유해야 하는 연결을 안전하게 여는 도우미.
 * 이전 화면의 같은 이름 연결이 아직 정리 중이라 설정이 실패하면, 화면을 멈추지 않고 잠시 뒤 다시 시도합니다.
 * setup 은 연결을 열고 '닫는 함수'를 돌려줘야 합니다. 이 함수가 돌려주는 함수를 부르면 모두 정리됩니다.
 */
export function setupWithRetry(setup: () => () => void, retryMs = 1500): () => void {
  let cleanup: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const attempt = () => {
    if (stopped) return;
    try {
      cleanup = setup();
    } catch (e) {
      console.warn("[inhub] 실시간 연결 재시도", e);
      timer = setTimeout(attempt, retryMs);
    }
  };
  attempt();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    cleanup?.();
  };
}
