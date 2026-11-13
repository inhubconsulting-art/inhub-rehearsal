-- ===== 쉬운 설명 =====
-- 2026-11-13 추가 변경. Supabase → SQL Editor 에 이 파일 내용을 통째로 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 문제없게 작성했습니다.
--  1) 가입 이메일 형식을 서버에서도 검사 (화면 검사를 우회해도 막힘)
--  2) 회원 탈퇴가 가능하도록, 기록(활동 로그·코멘트 등)이 탈퇴한 사람을 가리키면 '작성자 없음'으로 남김
--  3) 교육 차수 '보관' 기능용 칸 추가
-- =====================

-- 1) 가입 이메일 형식 검사 ------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$' then
    raise exception '이메일 형식이 올바르지 않습니다.';
  end if;
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

-- 2) 탈퇴해도 다른 사람의 기록은 남도록 연결 방식 변경 -------------------------
alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey foreign key (actor_id) references public.profiles (id) on delete set null;

alter table public.scenario_versions drop constraint if exists scenario_versions_created_by_fkey;
alter table public.scenario_versions
  add constraint scenario_versions_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.cohorts drop constraint if exists cohorts_instructor_id_fkey;
alter table public.cohorts
  add constraint cohorts_instructor_id_fkey foreign key (instructor_id) references public.profiles (id) on delete set null;

alter table public.instructor_notes alter column author_id drop not null;
alter table public.instructor_notes drop constraint if exists instructor_notes_author_id_fkey;
alter table public.instructor_notes
  add constraint instructor_notes_author_id_fkey foreign key (author_id) references public.profiles (id) on delete set null;

-- 코멘트 수정 시각 기록용
alter table public.instructor_notes add column if not exists updated_at timestamptz;

-- 3) 교육 차수 보관 ----------------------------------------------------------
alter table public.cohorts add column if not exists archived_at timestamptz;
