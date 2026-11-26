/**
 * ===== 쉬운 설명 =====
 * 무엇: 가상 수강생 16명. 소속·직무·경력·말투·타자 속도가 모두 다릅니다.
 * 언제: 테스트마다 한 명씩 돌아가며 배정됩니다 (같은 시나리오의 다른 테스트에는 다른 사람이 들어가도록 섞음).
 * 리뷰 포인트: 실제 수강생 분포와 비슷한지 보세요. 사람을 더 넣고 싶으면 이 목록에 한 줄 추가하면 됩니다.
 *   typingCps(1초당 글자 수)와 thinkSec(생각하는 초)은 '응답 시간'·'시간 초과' 분석에 쓰입니다.
 *   이름은 모두 지어낸 이름입니다.
 * =====================
 */
import type { Participant } from "./types.ts";

export const PARTICIPANTS: Participant[] = [
  { id: "p01", name: "김서연", age: 24, organization: "한빛은행", job: "콜센터 상담", career: "1년 미만", style: "격식체를 쓰지만 긴장해서 '음…', '어…'로 말을 자주 시작함", typingCps: 3.5, thinkSec: 6 },
  { id: "p02", name: "이준호", age: 31, organization: "누리보험", job: "고객지원", career: "3~5년", style: "짧고 사무적으로 말함. 필요한 말만 함", typingCps: 5.5, thinkSec: 3 },
  { id: "p03", name: "박지민", age: 27, organization: "성북구 도시관리공단", job: "민원 창구", career: "1~3년", style: "친절하고 공감 표현을 많이 씀. 문장이 길어지는 편", typingCps: 4, thinkSec: 5 },
  { id: "p04", name: "최민수", age: 45, organization: "대한통신", job: "현장 관리자", career: "5년 이상", style: "자신감 있고 단정적으로 말함. 가끔 '원래 그렇습니다' 같은 말버릇", typingCps: 2.5, thinkSec: 4 },
  { id: "p05", name: "정하은", age: 22, organization: "새봄병원", job: "원무과 접수", career: "없음", style: "신입이라 확신 없이 '일단', '그러니까'를 자주 씀. 맞춤법 실수가 가끔 있음", typingCps: 3, thinkSec: 8 },
  { id: "p06", name: "강도윤", age: 35, organization: "한빛은행", job: "카드 상담", career: "5년 이상", style: "매뉴얼대로 정확하게 말함. 쿠션어('실례지만', '번거로우시겠지만')를 잘 씀", typingCps: 5, thinkSec: 3 },
  { id: "p07", name: "윤아린", age: 29, organization: "누리보험", job: "보상 안내", career: "1~3년", style: "밝고 다정한 말투. '네네'를 자주 씀", typingCps: 4.5, thinkSec: 4 },
  { id: "p08", name: "장현우", age: 38, organization: "대한통신", job: "해지 방어", career: "3~5년", style: "말을 돌려서 하고 설득하려는 경향", typingCps: 4, thinkSec: 4 },
  { id: "p09", name: "한지수", age: 26, organization: "새봄병원", job: "예약 상담", career: "1년 미만", style: "조심스럽고 사과를 많이 함('죄송합니다'를 반복)", typingCps: 3.5, thinkSec: 6 },
  { id: "p10", name: "오세훈", age: 52, organization: "성북구 도시관리공단", job: "시설 안내", career: "5년 이상", style: "구어체가 섞이고 문장이 짧음. 타자가 느림", typingCps: 1.8, thinkSec: 7 },
  { id: "p11", name: "서유나", age: 33, organization: "한빛은행", job: "VIP 상담", career: "5년 이상", style: "고급스럽고 정중한 표현. 문장을 끝까지 완성함", typingCps: 6, thinkSec: 3 },
  { id: "p12", name: "임태양", age: 23, organization: "온마켓", job: "채팅 상담", career: "1년 미만", style: "채팅에 익숙해 짧게 끊어 보냄. '~요' 체", typingCps: 6.5, thinkSec: 2 },
  { id: "p13", name: "배수빈", age: 41, organization: "누리보험", job: "고객지원 팀장", career: "5년 이상", style: "차분하고 논리적. 순서대로 안내함", typingCps: 4, thinkSec: 4 },
  { id: "p14", name: "문가영", age: 28, organization: "온마켓", job: "교환·반품 상담", career: "1~3년", style: "공감은 잘하지만 정보 안내를 자주 빠뜨림", typingCps: 5, thinkSec: 4 },
  { id: "p15", name: "신동혁", age: 30, organization: "대한통신", job: "기술 상담", career: "3~5년", style: "전문 용어를 섞어 쓰는 경향", typingCps: 5, thinkSec: 3 },
  { id: "p16", name: "홍예린", age: 25, organization: "성북구 도시관리공단", job: "콜센터 상담", career: "1년 미만", style: "말끝을 흐리거나 '그…', '저기…'로 시작함", typingCps: 3, thinkSec: 7 },
];

/** 같은 입력이면 늘 같은 결과가 나오는 섞기 (재실행해도 배정이 같도록) */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
