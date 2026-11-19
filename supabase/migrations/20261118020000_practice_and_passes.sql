-- ===== 쉬운 설명 =====
-- 무엇: 개인 연습과 이용권 기능에 필요한 DB 구조입니다.
--   ① scenarios.practice_public : 이 시나리오를 '연습하기'(교육 코드 없는 개인 연습)에 보여줄지. 기본은 꺼짐
--   ② pass_ledger              : 이용권 장부. 한 줄 = 늘거나 준 횟수(+3, -1 …). 남은 횟수 = 합계
--   ③ pass_balance / consume_pass : 남은 횟수 계산, 개인 연습을 시작할 때 1회 차감(동시에 눌러도 두 번 빠지지 않게 잠금)
--   ④ 가입하면 체험 이용권 3회 자동 지급 + 이미 가입한 회원에게도 한 번 지급
--   ⑤ '개인 연습' 전용 교육 차수 1개 (client_name = '__practice__'). 개인 연습 기록은 모두 여기에 쌓이고, 강사 목록에는 보이지 않습니다.
-- 언제: 이 기능을 main 에 반영하기 '전에' Supabase SQL Editor 에서 한 번 실행합니다. 여러 번 실행해도 안전합니다(지급이 두 번 되지 않음).
-- 리뷰 포인트:
--  - 교육 과정(입장 코드) 실습은 이용권을 차감하지 않습니다. 차감은 개인 연습에서만 서버가 consume_pass 로 합니다.
--  - 개인 연습은 중간에 끝내도 시작할 때 이미 1회가 차감됩니다(AI 비용이 이미 발생).
-- =====================

-- ① 개인 연습 공개 표시
alter table public.scenarios add column if not exists practice_public boolean not null default false;

-- ② 이용권 장부
create table if not exists public.pass_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 늘면 +, 줄면 -
  delta int not null,
  -- signup_trial(가입 체험) / admin_grant(운영자 지급) / admin_revoke(운영자 회수) / practice(개인 연습 사용) / refund(시작 실패 환불)
  reason text not null check (reason in ('signup_trial', 'admin_grant', 'admin_revoke', 'practice', 'refund')),
  session_id uuid references public.sessions (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pass_ledger_user_idx on public.pass_ledger (user_id, created_at desc);
alter table public.pass_ledger enable row level security;
drop policy if exists pass_ledger_read_own on public.pass_ledger;
create policy pass_ledger_read_own on public.pass_ledger for select to authenticated using (user_id = auth.uid());

-- ③ 남은 횟수와 차감
create or replace function public.pass_balance(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.pass_ledger where user_id = p_user
$$;

create or replace function public.consume_pass(p_user uuid, p_note text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  -- 같은 사람이 동시에 두 번 눌러도 한 번씩 차례로 처리
  perform pg_advisory_xact_lock(hashtext('pass:' || p_user::text));
  if public.pass_balance(p_user) < 1 then
    raise exception 'NO_PASS' using errcode = 'P0001';
  end if;
  insert into public.pass_ledger (user_id, delta, reason, note) values (p_user, -1, 'practice', p_note) returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.pass_balance(uuid) from public, anon;
grant execute on function public.pass_balance(uuid) to authenticated, service_role;
revoke execute on function public.consume_pass(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_pass(uuid, text) to service_role;

-- ④ 가입 체험 이용권 3회
create or replace function public.grant_signup_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pass_ledger where user_id = new.id and reason = 'signup_trial') then
    insert into public.pass_ledger (user_id, delta, reason, note) values (new.id, 3, 'signup_trial', '가입 체험 이용권');
  end if;
  return new;
end $$;
drop trigger if exists profiles_signup_trial on public.profiles;
create trigger profiles_signup_trial after insert on public.profiles
for each row execute function public.grant_signup_trial();

-- 이미 가입한 회원에게도 한 번 지급 (이미 받은 사람은 건너뜀)
insert into public.pass_ledger (user_id, delta, reason, note)
select p.id, 3, 'signup_trial', '가입 체험 이용권 (기존 회원)'
from public.profiles p
where not exists (select 1 from public.pass_ledger l where l.user_id = p.id and l.reason = 'signup_trial');

-- ⑤ 개인 연습 전용 교육 차수 (하나만)
insert into public.cohorts (title, course_name, client_name, join_code, status, allowed_modes)
select '개인 연습', '개인 연습', '__practice__', 'PRACTICE-' || substr(md5(random()::text), 1, 10), 'running', array['text', 'voice']
where not exists (select 1 from public.cohorts where client_name = '__practice__');
