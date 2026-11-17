/**
 * ===== 쉬운 설명 =====
 * 무엇: 개인정보처리방침(/privacy)과 이용약관(/terms)에 들어가는 회사 정보·날짜·외부 업체 목록을 한곳에 모은 파일.
 * 언제: 두 문서 화면이 열릴 때 이 값을 읽어 씁니다.
 * 리뷰 포인트:
 *  - 【 】로 표시된 값은 꼭 실제 정보로 바꿔 주세요. 바꾸기 전까지는 화면에도 【 】 그대로 보입니다.
 *  - 문서 내용을 바꾸면 EFFECTIVE_DATE(시행일)도 새 날짜로 바꾸고, 이전 시행일은 PREVIOUS_VERSIONS에 남겨 두세요.
 *  - 이 문서는 서비스 실제 동작을 바탕으로 만든 초안입니다. 정식 게시 전에 법무 검토를 받는 것을 권장합니다.
 * =====================
 */

/** 서비스를 운영하는 회사 정보 */
export const OPERATOR = {
  /** 운영 주체(회사) 이름 */
  name: "인허브",
  /** 대표자 이름 (사업자 정보를 표시하지 않으려면 빈 문자열 "") */
  ceo: "조수연",
  /** 사업자등록번호 (표시하지 않으려면 "") */
  businessNumber: "",
  /** 주소 (표시하지 않으려면 "") */
  address: "서울특별시 마포구 양화로 136",
  /** 문의 이메일 */
  contactEmail: "pino@inhub.co.kr",
};

/** 개인정보 보호책임자 */
export const PRIVACY_OFFICER = {
  name: "김도연",
  /** 직책 (비워 두면 표시하지 않음) */
  position: "",
  email: "pino@inhub.co.kr",
};

/** 탈퇴하지 않은 사용자의 기록을 보관하는 기간 (문장으로) */
export const RETENTION_PERIOD = "마지막 이용일로부터 1년";

/** 시행일 (뒤의 T00:00:00+09:00 는 '한국 시간 0시'라는 뜻이니 날짜 부분만 바꾸세요) */
export const EFFECTIVE_DATE = "2026-11-18T00:00:00+09:00";

/** 이전 시행일 목록 (문서를 고칠 때마다 이전 시행일을 같은 형식으로 앞에 추가) */
export const PREVIOUS_VERSIONS: string[] = [];

/**
 * 개인정보 처리를 맡기는 외부 업체 (처리위탁·국외 이전).
 * 서버 위치가 바뀌면(예: Railway 지역 변경) country 값을 고쳐 주세요.
 */
export const PROCESSORS = [
  {
    company: "Supabase, Inc.",
    country: "대한민국(서울 데이터센터) · 운영사 소재지 미국",
    task: "회원 정보·실습 기록 저장, 로그인 처리",
    items: "이름, 이메일, 소속·부서·업종·직무·경력, 비밀번호(암호화), 대화 기록, 평가 결과",
    contact: "privacy@supabase.io",
  },
  {
    company: "OpenAI, L.L.C.",
    country: "미국",
    task: "AI 고객 대화 생성, 음성의 자막 변환, 응대 평가 리포트 작성",
    items: "실습 대화 내용(텍스트), 실습 중 음성(실시간 처리 후 녹음 원본 미저장)",
    contact: "privacy@openai.com",
  },
  {
    company: "Vercel Inc.",
    country: "대한민국(서울 리전) · 운영사 소재지 미국",
    task: "웹사이트 운영(호스팅)",
    items: "접속 기록(IP 주소, 브라우저 정보, 접속 시간)",
    contact: "privacy@vercel.com",
  },
  {
    company: "Railway Corporation",
    country: "미국",
    task: "음성 대화 기록 저장 보조, 평가 리포트 생성 작업 처리",
    items: "실습 대화 내용(텍스트), 평가 결과",
    contact: "privacy@railway.com",
  },
  {
    company: "Google LLC",
    country: "미국",
    task: "Google 계정 로그인 (Google로 가입한 경우에만)",
    items: "Google 계정 이름, 이메일, 프로필 사진 주소",
    contact: "https://policies.google.com/privacy",
  },
] as const;
