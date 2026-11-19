-- ===== 쉬운 설명 =====
-- 무엇: Metabase(운영 분석 도구) 전용 '읽기만 되는 출입증'(DB 접속 계정 metabase_ro)과,
--      개인정보(이름·이메일·대화 원문 등)를 뺀 분석용 표(analytics 스키마의 뷰)를 만듭니다.
--      Metabase는 analytics 안의 표만 볼 수 있고, 원본 표나 개인정보에는 접근할 수 없습니다.
-- 언제: Metabase를 연결하기 전에 Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전합니다.
--      서비스 화면·기능에는 영향이 없어서 배포와 상관없이 아무 때나 실행해도 됩니다.
-- 실행한 뒤 할 일: 아래 한 줄을 '본인이 정한 비밀번호'로 바꿔 SQL Editor에서 따로 실행하세요(파일에 저장하지 마세요).
--      alter role metabase_ro with password '여기에-긴-비밀번호';
-- 리뷰 포인트:
--  - 수강생은 번호(user_id)로만 보입니다. 이름·이메일·입장 코드·대화 원문·자유 입력 의견은 빠져 있습니다.
--  - 이 뷰들은 만든 사람(관리자) 권한으로 원본을 읽으므로 보안 규칙(RLS)과 상관없이 전체 통계가 보입니다.
--    대신 analytics 스키마는 웹사이트 API에 공개되지 않고, metabase_ro 에게만 읽기 권한을 줍니다.
--  - 시간은 UTC로 저장돼 있으니 Metabase '관리자 설정 → 지역화 → 보고서 시간대'를 Asia/Seoul 로 바꾸세요.
-- =====================

-- ① 읽기 전용 접속 계정 (비밀번호는 위 안내대로 따로 설정)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'metabase_ro') then
    create role metabase_ro login nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 5;
  end if;
end $$;
-- 실수로라도 쓰기가 안 되게 기본을 '읽기 전용'으로, 무거운 조회는 60초에서 멈추게
alter role metabase_ro set default_transaction_read_only = on;
alter role metabase_ro set statement_timeout = '60s';

-- ② 분석용 표를 모아 둘 공간
create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to metabase_ro;

-- ③ 분석용 표 (개인정보를 뺀 사본 보기)

-- 사용자: 이름·이메일·직무 직접 입력값은 제외
create or replace view analytics.users as
select
  p.id as user_id,
  p.role,
  p.organization,
  p.department,
  p.industry,
  p.job_category,
  p.job_id,
  p.career,
  p.created_at,
  p.profile_completed_at
from public.profiles p;

-- 교육 차수: 입장 코드·공지는 제외. 숨김 차수(관리자 테스트/개인 연습)는 kind 로 구분
create or replace view analytics.cohorts as
select
  c.id as cohort_id,
  c.title,
  c.course_name,
  case when c.client_name in ('__preview__', '__practice__') then null else c.client_name end as client_name,
  case c.client_name when '__preview__' then 'preview' when '__practice__' then 'practice' else 'class' end as kind,
  c.status,
  c.starts_at,
  c.instructor_id,
  c.sequential,
  c.time_limit_sec,
  c.allowed_modes,
  c.budget_usd,
  c.created_at,
  c.archived_at
from public.cohorts c;

create or replace view analytics.cohort_scenarios as
select cs.cohort_id, cs.scenario_id, cs.scenario_version, cs.position, cs.required
from public.cohort_scenarios cs;

create or replace view analytics.scenarios as
select s.id as scenario_id, s.title, s.industry, s.type, s.difficulty, s.status, s.practice_public, s.created_at
from public.scenarios s;

-- 교육 참여: 참여 당시 프로필 사본은 제외
create or replace view analytics.enrollments as
select e.id as enrollment_id, e.cohort_id, e.user_id, e.joined_at, e.last_seen_at, e.entry_source
from public.enrollments e;

-- 실습 1회: 대화 원문은 없음
create or replace view analytics.sessions as
select
  s.id as session_id,
  s.cohort_id,
  s.user_id,
  s.scenario_id,
  s.scenario_version,
  s.mode,
  s.status,
  s.started_at,
  s.ended_at,
  extract(epoch from (s.ended_at - s.started_at))::int as duration_sec,
  s.end_reason,
  s.turn_count,
  s.peak_emotion,
  s.resolved_at,
  s.handoff ->> 'status' as handoff_status,
  s.usage
from public.sessions s;

-- 평가 점수 (코멘트·인용문은 제외)
create or replace view analytics.evaluations as
select ev.session_id, ev.grade, ev.total_score, ev.model, ev.prompt_version, ev.created_at
from public.evaluations ev;

-- 역량별 점수: 평가 1건 × 역량 1개 = 한 줄
create or replace view analytics.competency_scores as
select
  ev.session_id,
  cs ->> 'competency' as competency,
  (cs ->> 'score')::numeric as score,
  ev.created_at
from public.evaluations ev
cross join lateral jsonb_array_elements(coalesce(ev.result -> 'competencyScores', '[]'::jsonb)) as cs;

-- 실습 1회 대화 분석 (자주 쓴 말 묶음은 원문 조각이라 제외)
create or replace view analytics.session_analytics as
select
  sa.session_id, sa.user_id, sa.cohort_id, sa.mode, sa.duration_sec,
  sa.learner_turns, sa.customer_turns,
  sa.avg_latency_sec, sa.median_latency_sec, sa.max_latency_sec,
  sa.avg_learner_chars, sa.talk_ratio,
  sa.filler_count, sa.cushion_count, sa.apology_count, sa.empathy_count, sa.forbidden_count,
  sa.filler_rate, sa.cushion_rate, sa.apology_rate, sa.empathy_rate, sa.forbidden_rate, sa.question_rate,
  sa.speaking_sec, sa.chars_per_sec, sa.speech_segments, sa.interruptions,
  sa.phrase_counts,
  sa.computed_at
from public.session_analytics sa;

-- 발화 1개 분석 (마지막 말 원문은 제외)
create or replace view analytics.utterances as
select
  ua.message_id, ua.session_id, ua.user_id, ua.seq, ua.chars, ua.sentence_count, ua.latency_sec,
  ua.fillers, ua.cushions, ua.apologies, ua.empathies, ua.forbidden, ua.is_question
from public.utterance_analytics ua;

-- 행동 기록 (👎 의견 등 자유 입력 글은 제외)
create or replace view analytics.events as
select le.id as event_id, le.user_id, le.session_id, le.cohort_id, le.type, le.props - 'comment' as props, le.created_at
from public.learner_events le;

-- 이용권 장부 (운영자 메모는 제외)
create or replace view analytics.pass_ledger as
select pl.id as ledger_id, pl.user_id, pl.delta, pl.reason, pl.session_id, pl.created_at
from public.pass_ledger pl;

create or replace view analytics.phrase_lexicon as
select pl.category, pl.phrase, pl.active, pl.created_at
from public.phrase_lexicon pl;

-- ④ 읽기 권한: analytics 안의 표만, metabase_ro 에게만
-- (Supabase 기본 계정인 anon·authenticated 가 혹시 권한을 받았더라도 거둬들임)
revoke all on all tables in schema analytics from public, anon, authenticated;
revoke all on schema analytics from anon, authenticated;
grant select on all tables in schema analytics to metabase_ro;
