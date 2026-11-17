-- ===== 쉬운 설명 =====
-- 무엇: 수강생 프로필에 부서·업종·직무·경력 칸을 추가하고, 교육 입장 당시 프로필을 따로 기록하는 칸을 추가합니다.
-- 언제: 이 기능을 main 에 반영하기 '전에' Supabase SQL Editor 에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.
-- 리뷰 포인트:
--  - 칸 추가만 하므로 지금 실서비스 코드가 그대로 동작합니다(먼저 실행해도 서비스가 깨지지 않음).
--  - 기존 회원은 profile_completed_at 이 비어 있어서, 새 코드 반영 후 다음 로그인 때 '프로필 완성' 화면을 한 번 거칩니다.
--    (강사·관리자는 거치지 않습니다.)
-- =====================

alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists industry text;
alter table public.profiles add column if not exists job_category text;
alter table public.profiles add column if not exists job_id text;
alter table public.profiles add column if not exists job_custom text;
alter table public.profiles add column if not exists career text;
alter table public.profiles add column if not exists profile_completed_at timestamptz;

-- 교육 입장 시점의 프로필 사본 (나중에 이직·경력 변화가 있어도 그 교육은 당시 기준으로 분석)
alter table public.enrollments add column if not exists profile_snapshot jsonb;

-- 분석 화면에서 그룹별로 빠르게 모으기 위한 색인
create index if not exists profiles_job_category_idx on public.profiles (job_category);
create index if not exists profiles_industry_idx on public.profiles (industry);
