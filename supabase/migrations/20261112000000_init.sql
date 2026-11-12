-- ===== 쉬운 설명 =====
-- 무엇: DB의 모든 표(사용자, 시나리오, 교육 차수, 대화, 발화, 평가 등)와 '누가 무엇을 볼 수 있는지' 규칙(RLS),
--     리포트 대기열을 만드는 설치 스크립트입니다.
-- 언제: Supabase 프로젝트를 처음 만들 때 한 번 실행합니다.
-- 리뷰 포인트: 표 이름과 칸이 PRD 10장 데이터 모델과 맞는지, 'RLS' 부분에서 수강생은 본인 것만·강사는 담당 차수만·관리자는
--         전체를 보도록 되어 있는지 확인하세요.
-- =====================
-- 인허브 리허설 초기 스키마
-- 모든 쓰기는 서버(service_role)가 하고, 브라우저는 RLS 로 허용된 행만 읽는다 (실시간 구독 포함).

create extension if not exists pgmq;

-- ───────────────────────── 공통 ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── 사용자 ─────────────────────────
-- 쉬운 설명: 사용자 표. 가입하면 자동으로 한 줄 생기고, 역할(role)은 기본 '수강생'입니다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  organization text,
  email text,
  role text not null default 'learner' check (role in ('learner', 'instructor', 'admin')),
  created_at timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, organization, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'organization',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ───────────────────────── 시나리오 ─────────────────────────
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  industry text not null,
  type text not null,
  difficulty text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger scenarios_touch before update on public.scenarios
for each row execute function public.touch_updated_at();

-- 버전별 불변 저장 (PRD S-01)
-- 쉬운 설명: 시나리오 내용은 버전마다 따로 보관합니다. 고쳐도 옛 버전은 지워지지 않습니다.
create table public.scenario_versions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  version int not null,
  content jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (scenario_id, version)
);

-- ───────────────────────── 교육 차수 ─────────────────────────
-- 쉬운 설명: 교육 차수 표. 입장 코드, 상태(준비/실습 중/일시정지/종료), 허용 대화 방식, 제한 시간 등이 들어갑니다.
create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_name text,
  client_name text,
  starts_at timestamptz,
  instructor_id uuid references public.profiles (id),
  join_code text not null unique,
  status text not null default 'ready' check (status in ('ready', 'running', 'paused', 'ended')),
  allowed_modes text[] not null default array['text', 'voice'],
  time_limit_sec int,
  sequential boolean not null default false,
  announcement text,
  budget_usd numeric,
  created_at timestamptz not null default now()
);

create table public.cohort_scenarios (
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id),
  scenario_version int not null,
  position int not null default 0,
  required boolean not null default true,
  primary key (cohort_id, scenario_id)
);

-- 쉬운 설명: 누가 어느 교육 차수에 참여했는지 기록하는 표 (동의 시각 포함).
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  consent_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

create or replace function public.is_cohort_instructor(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cohorts where id = cid and instructor_id = auth.uid())
$$;

create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where cohort_id = cid and user_id = auth.uid())
$$;

-- ───────────────────────── 대화 세션 ─────────────────────────
-- 쉬운 설명: 대화 1회를 기록하는 표. 진행 상태, 종료 사유, 턴 수, 고객 감정(현재/최고), 사용량이 들어갑니다.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id),
  scenario_version int not null,
  mode text not null check (mode in ('text', 'voice')),
  status text not null default 'active' check (status in ('active', 'ended', 'evaluating', 'evaluated', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  turn_count int not null default 0,
  current_emotion int,
  peak_emotion int,
  openai_call_id text,
  last_activity_at timestamptz not null default now(),
  usage jsonb not null default '{}'::jsonb
);
create index sessions_cohort_idx on public.sessions (cohort_id, started_at desc);
create index sessions_user_idx on public.sessions (user_id, started_at desc);

-- 쉬운 설명: 발화 하나하나를 순번(seq)과 함께 기록하는 표. 리포트의 '#번호'가 이 순번입니다.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  seq int not null,
  role text not null check (role in ('learner', 'customer')),
  content text not null,
  emotion int,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

-- 발화 추가 (순번 부여 + 세션 집계 갱신을 한 번에)
create or replace function public.append_message(
  p_session_id uuid, p_role text, p_content text, p_emotion int default null
) returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  next_seq int;
  row public.messages;
begin
  perform 1 from public.sessions where id = p_session_id for update;
  select coalesce(max(seq), 0) + 1 into next_seq from public.messages where session_id = p_session_id;
  insert into public.messages (session_id, seq, role, content, emotion)
  values (p_session_id, next_seq, p_role, p_content, p_emotion)
  returning * into row;

  update public.sessions set
    turn_count = turn_count + case when p_role = 'learner' then 1 else 0 end,
    last_activity_at = now()
  where id = p_session_id;
  return row;
end $$;

-- 고객 감정 갱신 (마지막 고객 발화에 기록 + 세션 현재/최고치)
create or replace function public.set_customer_emotion(p_session_id uuid, p_emotion int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages set emotion = p_emotion
  where id = (
    select id from public.messages
    where session_id = p_session_id and role = 'customer'
    order by seq desc limit 1
  );
  update public.sessions set
    current_emotion = p_emotion,
    peak_emotion = greatest(coalesce(peak_emotion, 0), p_emotion)
  where id = p_session_id;
end $$;

-- ───────────────────────── 평가 ─────────────────────────
-- 쉬운 설명: AI 평가 결과 표. 대화 1회당 1개.
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  grade text not null,
  total_score numeric not null,
  result jsonb not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

-- 쉬운 설명: 강사 코멘트·점수 보정 표. 고칠 때마다 새 줄이 추가되어 이력이 남습니다.
create table public.instructor_notes (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  comment text,
  score_override numeric,
  created_at timestamptz not null default now()
);

create table public.cohort_summaries (
  cohort_id uuid primary key references public.cohorts (id) on delete cascade,
  content jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  evaluation_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_versions enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_scenarios enable row level security;
alter table public.enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.evaluations enable row level security;
alter table public.instructor_notes enable row level security;
alter table public.cohort_summaries enable row level security;
alter table public.audit_logs enable row level security;

-- 쉬운 설명: 여기부터 '누가 무엇을 볼 수 있는가' 규칙. 수강생=본인 것, 강사=담당 차수, 관리자=전체.
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    where e.user_id = profiles.id and c.instructor_id = auth.uid()
  )
);

create policy scenarios_read on public.scenarios for select to authenticated
  using (public.my_role() in ('admin', 'instructor'));
create policy scenario_versions_read on public.scenario_versions for select to authenticated
  using (public.my_role() in ('admin', 'instructor'));

create policy cohorts_read on public.cohorts for select to authenticated using (
  public.is_admin() or instructor_id = auth.uid() or public.is_enrolled(id)
);
create policy cohort_scenarios_read on public.cohort_scenarios for select to authenticated using (
  public.is_admin() or public.is_cohort_instructor(cohort_id) or public.is_enrolled(cohort_id)
);
create policy enrollments_read on public.enrollments for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or public.is_cohort_instructor(cohort_id)
);
create policy sessions_read on public.sessions for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or public.is_cohort_instructor(cohort_id)
);
create policy messages_read on public.messages for select to authenticated using (
  exists (
    select 1 from public.sessions s where s.id = messages.session_id
    and (s.user_id = auth.uid() or public.is_admin() or public.is_cohort_instructor(s.cohort_id))
  )
);
create policy evaluations_read on public.evaluations for select to authenticated using (
  exists (
    select 1 from public.sessions s where s.id = evaluations.session_id
    and (s.user_id = auth.uid() or public.is_admin() or public.is_cohort_instructor(s.cohort_id))
  )
);
create policy instructor_notes_read on public.instructor_notes for select to authenticated using (
  exists (
    select 1 from public.evaluations ev join public.sessions s on s.id = ev.session_id
    where ev.id = instructor_notes.evaluation_id
    and (s.user_id = auth.uid() or public.is_admin() or public.is_cohort_instructor(s.cohort_id))
  )
);
create policy cohort_summaries_read on public.cohort_summaries for select to authenticated using (
  public.is_admin() or public.is_cohort_instructor(cohort_id)
);
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ───────────────────────── 실시간 구독 대상 ─────────────────────────
-- 쉬운 설명: 아래 표가 바뀌면 화면에 실시간으로 알려줍니다 (강사 대시보드, 대화 화면).
alter publication supabase_realtime add table public.cohorts;
alter publication supabase_realtime add table public.enrollments;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.evaluations;
alter publication supabase_realtime add table public.cohort_summaries;

-- ───────────────────────── 작업 대기열 (Supabase Queues / pgmq) ─────────────────────────
-- 쉬운 설명: 리포트 생성 대기열을 만듭니다. 대화가 끝나면 여기에 '평가해 주세요' 작업이 쌓입니다.
select pgmq.create('jobs');

create or replace function public.enqueue_job(payload jsonb) returns bigint
language sql security definer set search_path = public, pgmq as $$
  select * from pgmq.send('jobs', payload);
$$;

create or replace function public.read_jobs(vt int, qty int)
returns table (msg_id bigint, read_ct int, message jsonb)
language sql security definer set search_path = public, pgmq as $$
  select r.msg_id, r.read_ct, r.message from pgmq.read('jobs', vt, qty) r;
$$;

create or replace function public.delete_job(p_msg_id bigint) returns boolean
language sql security definer set search_path = public, pgmq as $$
  select pgmq.delete('jobs', p_msg_id);
$$;

create or replace function public.archive_job(p_msg_id bigint) returns boolean
language sql security definer set search_path = public, pgmq as $$
  select pgmq.archive('jobs', p_msg_id);
$$;

-- 세션 종료 + 평가 작업 등록을 한 번에. 이미 끝난 세션이면 false.
-- 쉬운 설명: 대화 종료와 평가 요청을 한 번에 처리합니다. 이미 끝난 대화는 두 번 처리하지 않습니다.
create or replace function public.end_session(p_session_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public, pgmq as $$
declare
  changed int;
begin
  update public.sessions
  set status = 'ended', ended_at = now(), end_reason = p_reason
  where id = p_session_id and status = 'active';
  get diagnostics changed = row_count;
  if changed = 0 then
    return false;
  end if;
  perform pgmq.send('jobs', jsonb_build_object('kind', 'evaluate_session', 'sessionId', p_session_id));
  return true;
end $$;
revoke execute on function public.end_session(uuid, text) from public, anon, authenticated;
grant execute on function public.end_session(uuid, text) to service_role;

-- 서버 전용 함수는 브라우저에서 호출하지 못하게 막는다
revoke execute on function public.enqueue_job(jsonb) from public, anon, authenticated;
revoke execute on function public.read_jobs(int, int) from public, anon, authenticated;
revoke execute on function public.delete_job(bigint) from public, anon, authenticated;
revoke execute on function public.archive_job(bigint) from public, anon, authenticated;
revoke execute on function public.append_message(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.set_customer_emotion(uuid, int) from public, anon, authenticated;
grant execute on function public.enqueue_job(jsonb) to service_role;
grant execute on function public.read_jobs(int, int) to service_role;
grant execute on function public.delete_job(bigint) to service_role;
grant execute on function public.archive_job(bigint) to service_role;
grant execute on function public.append_message(uuid, text, text, int) to service_role;
grant execute on function public.set_customer_emotion(uuid, int) to service_role;
