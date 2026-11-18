-- ===== 쉬운 설명 =====
-- 무엇: 학습 데이터 분석을 위한 표 4개와 칸 1개를 추가합니다.
--   ① learner_events      : 행동 기록 (접속, 로그인, 리포트 열람, 평가 동의, 현실감 점수, 음성 발화 시간 등)
--   ② session_analytics   : 실습 1회마다 계산해 둔 대화 분석 결과 (응답 시간, 발화 길이, 쿠션어·금지어 횟수 등)
--   ③ utterance_analytics : 수강생 발화 문장마다 구조화한 분석 결과 (어떤 쿠션어·필러·금지 표현을 썼는지)
--   ④ phrase_lexicon      : 쿠션어·사과·공감·금지 표현·필러 목록 (기본 목록 포함, 관리자 화면에서 고칠 예정)
--   + enrollments.entry_source : 교육에 어떻게 들어왔는지 (qr / link / code)
-- 언제: 이 기능을 main 에 반영하기 '전에' Supabase SQL Editor 에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.
-- 리뷰 포인트:
--  - 새 표만 추가하고 기존 표는 칸 1개만 추가하므로, 먼저 실행해도 지금 서비스는 그대로 동작합니다.
--  - 네 표 모두 브라우저에서 직접 읽고 쓸 수 없고(보안 규칙만 켜고 허용 규칙 없음), 서버만 접근합니다.
--  - 회원이 탈퇴하면 그 사람의 기록도 함께 지워집니다(on delete cascade).
-- =====================

-- ① 행동 기록 (이벤트 로그): 누가, 언제, 무엇을, 어떤 조건에서
create table if not exists public.learner_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete cascade,
  cohort_id uuid references public.cohorts (id) on delete set null,
  type text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists learner_events_user_idx on public.learner_events (user_id, created_at desc);
create index if not exists learner_events_session_idx on public.learner_events (session_id, type);
create index if not exists learner_events_type_idx on public.learner_events (type, created_at desc);
create index if not exists learner_events_cohort_idx on public.learner_events (cohort_id, type);
alter table public.learner_events enable row level security;

-- ② 실습 1회 분석 결과
create table if not exists public.session_analytics (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid references public.cohorts (id) on delete cascade,
  mode text,
  duration_sec int,
  learner_turns int,
  customer_turns int,
  -- 응답 시간(초): 고객 말 → 수강생 답 (텍스트 모드만. 음성은 자막 변환 시간이 섞여 비워 둠)
  avg_latency_sec numeric,
  median_latency_sec numeric,
  max_latency_sec numeric,
  -- 발화 길이(공백 뺀 글자 수)와 말 비율(수강생 글자 ÷ 전체 글자)
  avg_learner_chars numeric,
  talk_ratio numeric,
  -- 표현 사용 횟수
  filler_count int,
  cushion_count int,
  apology_count int,
  empathy_count int,
  forbidden_count int,
  -- 표현이 한 번이라도 들어간 수강생 발화의 비율(%)
  filler_rate numeric,
  cushion_rate numeric,
  apology_rate numeric,
  empathy_rate numeric,
  forbidden_rate numeric,
  question_rate numeric,
  -- 음성 숫자 지표 (녹음 없이 시간만): 말한 시간, 말 속도(글자/초), 말 덩어리 수, AI가 말하는 중 끼어든 횟수
  speaking_sec numeric,
  chars_per_sec numeric,
  speech_segments int,
  interruptions int,
  -- 표현별 횟수 {"cushion": {"실례지만": 2}, ...} 와 자주 쓴 말 묶음 [["될 것 같아요", 3], ...] (말버릇 찾기용)
  phrase_counts jsonb not null default '{}'::jsonb,
  top_ngrams jsonb not null default '[]'::jsonb,
  analyzer_version int not null,
  lexicon_hash text not null,
  computed_at timestamptz not null default now()
);
create index if not exists session_analytics_user_idx on public.session_analytics (user_id);
create index if not exists session_analytics_cohort_idx on public.session_analytics (cohort_id);
alter table public.session_analytics enable row level security;

-- ③ 수강생 발화 문장별 구조화 결과
create table if not exists public.utterance_analytics (
  message_id uuid primary key references public.messages (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seq int not null,
  chars int not null,
  sentence_count int not null,
  latency_sec numeric,
  fillers text[] not null default '{}',
  cushions text[] not null default '{}',
  apologies text[] not null default '{}',
  empathies text[] not null default '{}',
  forbidden text[] not null default '{}',
  is_question boolean not null default false,
  last_phrase text
);
create index if not exists utterance_analytics_session_idx on public.utterance_analytics (session_id, seq);
create index if not exists utterance_analytics_user_idx on public.utterance_analytics (user_id);
alter table public.utterance_analytics enable row level security;

-- ④ 표현 목록
create table if not exists public.phrase_lexicon (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cushion', 'apology', 'empathy', 'forbidden', 'filler')),
  phrase text not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (category, phrase)
);
alter table public.phrase_lexicon enable row level security;

-- 기본 목록 (이미 있으면 건너뜀). 관리자 화면에서 추가·삭제할 수 있게 될 예정입니다.
insert into public.phrase_lexicon (category, phrase) values
  -- 쿠션어: 부탁·거절·질문 앞에 붙여 말을 부드럽게 하는 표현
  ('cushion', '실례지만'), ('cushion', '실례합니다만'), ('cushion', '죄송하지만'), ('cushion', '죄송합니다만'),
  ('cushion', '번거로우시겠지만'), ('cushion', '수고스러우시겠지만'), ('cushion', '바쁘시겠지만'), ('cushion', '불편하시겠지만'),
  ('cushion', '괜찮으시다면'), ('cushion', '가능하시다면'), ('cushion', '혹시'), ('cushion', '양해 부탁'),
  ('cushion', '여쭤봐도'), ('cushion', '여쭤보겠습니다'), ('cushion', '번거롭게 해 드려'),
  -- 사과
  ('apology', '죄송합니다'), ('apology', '죄송해요'), ('apology', '미안합니다'), ('apology', '사과드립니다'),
  ('apology', '불편을 드려'), ('apology', '불편을 끼쳐'), ('apology', '심려를 끼쳐'), ('apology', '혼란을 드려'), ('apology', '송구합니다'),
  -- 공감
  ('empathy', '불편하셨겠'), ('empathy', '답답하셨겠'), ('empathy', '속상하셨겠'), ('empathy', '당황하셨겠'),
  ('empathy', '놀라셨겠'), ('empathy', '힘드셨겠'), ('empathy', '걱정되셨겠'), ('empathy', '화가 나셨'),
  ('empathy', '기다리시느라'), ('empathy', '이해합니다'), ('empathy', '이해가 됩니다'), ('empathy', '충분히 그러실'),
  ('empathy', '그러셨군요'), ('empathy', '그러셨겠어요'), ('empathy', '마음이 상하셨'),
  -- 금지 표현: 고객을 막거나 책임을 돌리는 말
  ('forbidden', '안 됩니다'), ('forbidden', '안돼요'), ('forbidden', '규정상'), ('forbidden', '원래 그렇'),
  ('forbidden', '모르겠습니다'), ('forbidden', '모르겠어요'), ('forbidden', '제 담당이 아닙'), ('forbidden', '제 담당 아닙'),
  ('forbidden', '어쩔 수 없'), ('forbidden', '방법이 없'), ('forbidden', '고객님이 잘못'), ('forbidden', '고객님 실수'),
  ('forbidden', '아까 말씀드렸'), ('forbidden', '제가 어떻게'), ('forbidden', '저한테 그러셔도'), ('forbidden', '그건 고객님 사정'),
  -- 필러: 말 앞뒤에 버릇처럼 붙는 말 (뒤에 쉼표·말줄임표가 오거나 혼자 있을 때만 셈)
  ('filler', '음'), ('filler', '어'), ('filler', '아'), ('filler', '그'), ('filler', '저'), ('filler', '저기'),
  ('filler', '뭐'), ('filler', '일단'), ('filler', '약간'), ('filler', '사실'), ('filler', '그러니까'), ('filler', '네네'), ('filler', '그게')
on conflict (category, phrase) do nothing;

-- 교육에 어떻게 들어왔는지: qr(QR 촬영) / link(공유 주소) / code(코드 직접 입력)
alter table public.enrollments add column if not exists entry_source text;
