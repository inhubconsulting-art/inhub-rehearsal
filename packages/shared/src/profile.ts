/**
 * ===== 쉬운 설명 =====
 * 무엇: 수강생 프로필의 선택 목록(직무 대분류→세부 직무, 업종, 경력)과 입력 검사 규칙.
 * 언제: '프로필 완성' 화면, '내 계정' 수정, 교육 입장 시 정보 기록, 분석 화면에서 그룹을 나눌 때.
 * 리뷰 포인트:
 *  - 목록을 바꾸고 싶으면 label(화면에 보이는 이름)만 고치세요. id(영문)는 DB에 저장되는 값이라
 *    바꾸면 이미 저장된 값과 연결이 끊깁니다. 새 항목은 새 id로 추가하고, 없앨 항목은 지우지 말고 hidden: true 로 숨기세요.
 *  - CS 업무는 모든 업종에 있으므로 '무슨 일을 하는지(직무)'와 '어떤 회사인지(업종)'를 따로 받습니다.
 * =====================
 */
import { z } from "zod";

export interface JobOption {
  id: string;
  label: string;
  /** 새로 고르지 못하게 숨김 (이미 저장된 값은 그대로 표시) */
  hidden?: boolean;
}
export interface JobCategory {
  id: string;
  label: string;
  jobs: JobOption[];
}

/** 직무: 대분류 → 세부 직무 (세부 직무 하나를 고름) */
export const JOB_CATEGORIES: JobCategory[] = [
  {
    id: "cs",
    label: "고객상담·TM",
    jobs: [
      { id: "cs_inbound", label: "인바운드 상담" },
      { id: "cs_outbound", label: "아웃바운드·TM" },
      { id: "cs_chat", label: "채팅·게시판 상담" },
      { id: "cs_voc", label: "VOC·클레임 처리" },
      { id: "cs_tech", label: "기술 상담·헬프데스크" },
      { id: "cs_qa", label: "상담 품질관리(QA)·코칭" },
      { id: "cs_sv", label: "상담센터 관리자(SV·팀장)" },
      { id: "cs_trainer", label: "CS 강사·교육 담당" },
    ],
  },
  {
    id: "service",
    label: "서비스·매장",
    jobs: [
      { id: "svc_store", label: "매장 판매·응대" },
      { id: "svc_store_mgr", label: "매장 관리자·점장" },
      { id: "svc_hotel", label: "호텔·숙박 프런트" },
      { id: "svc_fnb", label: "외식·카페 서비스" },
      { id: "svc_travel", label: "여행·항공 서비스(승무원·지상직)" },
      { id: "svc_leisure", label: "레저·문화시설 안내" },
      { id: "svc_beauty", label: "뷰티·웰니스 서비스" },
      { id: "svc_reception", label: "안내 데스크·리셉션" },
    ],
  },
  {
    id: "sales",
    label: "영업·판매",
    jobs: [
      { id: "sales_field", label: "대면 영업" },
      { id: "sales_b2b", label: "B2B·기술 영업" },
      { id: "sales_mgmt", label: "영업 관리" },
      { id: "sales_crm", label: "고객관리(CRM)" },
      { id: "sales_online", label: "온라인 판매·쇼핑몰 운영" },
      { id: "sales_car", label: "자동차 판매·서비스 어드바이저" },
    ],
  },
  {
    id: "finance",
    label: "금융·보험",
    jobs: [
      { id: "fin_teller", label: "은행 창구" },
      { id: "fin_loan", label: "대출·카드 상담" },
      { id: "fin_wealth", label: "자산관리·PB" },
      { id: "fin_ins_plan", label: "보험 설계" },
      { id: "fin_ins_claim", label: "보험 보상·손해사정" },
      { id: "fin_securities", label: "증권 상담" },
    ],
  },
  {
    id: "public",
    label: "공공·복지",
    jobs: [
      { id: "pub_civil", label: "민원 응대(행정)" },
      { id: "pub_callcenter", label: "공공 콜센터(120 등)" },
      { id: "pub_facility", label: "공공시설 운영·안내(체육·문화·주차 등)" },
      { id: "pub_welfare", label: "사회복지·상담" },
      { id: "pub_corp", label: "공기업·공단 고객지원" },
    ],
  },
  {
    id: "medical",
    label: "의료",
    jobs: [
      { id: "med_admin", label: "원무·접수·수납" },
      { id: "med_nurse", label: "간호" },
      { id: "med_coord", label: "의료 상담·코디네이터" },
      { id: "med_pharmacy", label: "약국" },
      { id: "med_care", label: "요양·돌봄" },
    ],
  },
  {
    id: "it_telecom",
    label: "IT·통신",
    jobs: [
      { id: "it_support", label: "IT 기술지원" },
      { id: "it_ops", label: "서비스 운영·관리" },
      { id: "it_telecom_store", label: "통신 대리점·개통" },
      { id: "it_telecom_as", label: "통신 설치·AS" },
      { id: "it_dev", label: "개발·기획" },
    ],
  },
  {
    id: "logistics",
    label: "운전·운송·배송",
    jobs: [
      { id: "log_delivery", label: "배송·택배" },
      { id: "log_driver", label: "운송·운전(버스·택시 등)" },
      { id: "log_center", label: "물류센터 고객대응" },
    ],
  },
  {
    id: "field",
    label: "설치·수리·생산",
    jobs: [
      { id: "fld_as", label: "설치·수리 기사(AS)" },
      { id: "fld_quality", label: "품질·클레임 대응" },
      { id: "fld_production", label: "생산·제조" },
    ],
  },
  {
    id: "realestate",
    label: "부동산·시설관리",
    jobs: [
      { id: "re_agent", label: "중개·분양 상담" },
      { id: "re_building", label: "건물·아파트 관리" },
      { id: "re_security", label: "보안·경비" },
    ],
  },
  {
    id: "education",
    label: "교육",
    jobs: [
      { id: "edu_teacher", label: "강사·교사" },
      { id: "edu_admin", label: "교육 운영·행정" },
      { id: "edu_counsel", label: "학습·입시 상담" },
    ],
  },
  {
    id: "office",
    label: "사무·경영지원",
    jobs: [
      { id: "ofc_general", label: "총무·사무" },
      { id: "ofc_hr", label: "인사·HRD" },
      { id: "ofc_finance", label: "회계·재무" },
      { id: "ofc_legal", label: "법무" },
      { id: "ofc_purchase", label: "구매·자재" },
    ],
  },
  {
    id: "planning",
    label: "기획·마케팅",
    jobs: [
      { id: "pln_strategy", label: "기획·전략" },
      { id: "pln_marketing", label: "마케팅·홍보" },
      { id: "pln_md", label: "상품기획·MD" },
      { id: "pln_cx", label: "CX·서비스 기획" },
    ],
  },
  {
    id: "other",
    label: "기타",
    jobs: [
      { id: "oth_student", label: "학생·취업 준비" },
      { id: "oth_self", label: "자영업" },
      { id: "oth_custom", label: "기타 (직접 입력)" },
    ],
  },
];

/** '기타 (직접 입력)'을 고르면 직접 쓴 직무명을 함께 저장 */
export const CUSTOM_JOB_ID = "oth_custom";

/** 업종: 다니는 회사·기관의 분야 */
export const PROFILE_INDUSTRIES: JobOption[] = [
  { id: "public_gov", label: "공공기관·지자체" },
  { id: "public_corp", label: "공기업·공단" },
  { id: "finance", label: "은행·카드·증권" },
  { id: "insurance", label: "보험" },
  { id: "retail", label: "유통·백화점·마트" },
  { id: "ecommerce", label: "온라인 쇼핑·플랫폼" },
  { id: "telecom", label: "통신" },
  { id: "it", label: "IT·소프트웨어" },
  { id: "manufacturing", label: "제조·전자·자동차" },
  { id: "medical", label: "병원·의료" },
  { id: "travel", label: "여행·항공·호텔" },
  { id: "fnb", label: "외식·식음료" },
  { id: "logistics", label: "물류·운송" },
  { id: "realestate", label: "부동산·건설" },
  { id: "energy", label: "에너지·가스·수도" },
  { id: "education", label: "교육" },
  { id: "outsourcing", label: "콜센터·BPO 아웃소싱" },
  { id: "culture", label: "문화·레저·스포츠" },
  { id: "etc", label: "기타" },
];

/** 경력 (현재 직무 기준 아님, 고객 응대 업무 총 경력) */
export const CAREER_BANDS: JobOption[] = [
  { id: "none", label: "경력 없음" },
  { id: "lt1", label: "1년 미만" },
  { id: "y1_3", label: "1~3년" },
  { id: "y3_5", label: "3~5년" },
  { id: "y5_10", label: "5~10년" },
  { id: "gt10", label: "10년 이상" },
];

/** id로 세부 직무와 대분류 찾기 */
export function findJob(jobId: string | null | undefined): { category: JobCategory; job: JobOption } | null {
  if (!jobId) return null;
  for (const category of JOB_CATEGORIES) {
    const job = category.jobs.find((j) => j.id === jobId);
    if (job) return { category, job };
  }
  return null;
}

/** 화면 표시용 직무 이름. 예) "고객상담·TM > 인바운드 상담", 직접 입력이면 "기타 > (입력값)" */
export function jobLabel(jobId: string | null | undefined, custom?: string | null): string {
  const f = findJob(jobId);
  if (!f) return "-";
  if (f.job.id === CUSTOM_JOB_ID) return `기타 > ${custom?.trim() || "직접 입력"}`;
  return `${f.category.label} > ${f.job.label}`;
}

export function industryLabel(id: string | null | undefined): string {
  return PROFILE_INDUSTRIES.find((i) => i.id === id)?.label ?? "-";
}

export function careerLabel(id: string | null | undefined): string {
  return CAREER_BANDS.find((c) => c.id === id)?.label ?? "-";
}

const ids = (list: JobOption[]) => list.map((o) => o.id) as [string, ...string[]];
const ALL_JOB_IDS = JOB_CATEGORIES.flatMap((c) => c.jobs.map((j) => j.id)) as [string, ...string[]];

/** 프로필 완성·수정 입력값 검사 */
export const ProfileAttributesSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40),
    organization: z.string().trim().min(1, "소속(회사·기관)을 입력해 주세요.").max(80),
    department: z.string().trim().max(80).nullable().default(null),
    industry: z.enum(ids(PROFILE_INDUSTRIES), { message: "업종을 골라 주세요." }),
    jobId: z.enum(ALL_JOB_IDS, { message: "직무를 골라 주세요." }),
    jobCustom: z.string().trim().max(40).nullable().default(null),
    career: z.enum(ids(CAREER_BANDS), { message: "경력을 골라 주세요." }),
  })
  .refine((v) => v.jobId !== CUSTOM_JOB_ID || !!v.jobCustom, { message: "직무를 직접 입력해 주세요.", path: ["jobCustom"] });
export type ProfileAttributes = z.infer<typeof ProfileAttributesSchema>;

/** 교육 입장 시점에 기록해 두는 프로필 사본 (나중에 바뀌어도 그때 기준으로 분석) */
export interface ProfileSnapshot {
  organization: string | null;
  department: string | null;
  industry: string | null;
  job_category: string | null;
  job_id: string | null;
  job_custom: string | null;
  career: string | null;
}
