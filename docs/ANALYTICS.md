# 학습 데이터 수집 구조 (분석 대시보드 1차, PR A)

> 쉬운 설명: 수강생이 서비스를 쓰는 동안 무엇이 어디에 쌓이는지 정리한 문서입니다. 분석 화면(PR C)을 만들 때 이 표들을 읽습니다.

## 1. 새로 생긴 표 (`supabase/migrations/20261118000000_learning_analytics.sql`)

| 표 | 한 줄 = | 누가 채우나 | 주요 내용 |
|---|---|---|---|
| `learner_events` | 행동 1번 | 웹앱 서버, 상시 서버 | 누가·언제·무엇을(`type`)·조건(`props`) |
| `session_analytics` | 실습 1회 | 상시 서버 (평가 직후 + 2분마다 밀린 것) | 응답 시간, 발화 길이, 말 비율, 표현 사용 횟수·비율, 음성 말 시간·속도·끼어들기, 자주 쓴 말 묶음 |
| `utterance_analytics` | 수강생 발화 1개 | 상시 서버 | 글자 수, 응답 시간, 찾은 필러·쿠션어·사과·공감·금지 표현, 질문 여부, 마지막 말 |
| `phrase_lexicon` | 표현 1개 | SQL 기본값 (관리자 화면은 PR B) | 분류(cushion/apology/empathy/forbidden/filler), 표현, 사용 여부 |

그리고 `enrollments.entry_source`: 교육에 어떻게 들어왔는지 (`qr` / `link` / `code`).

네 표 모두 브라우저에서 직접 읽고 쓸 수 없고 서버만 접근합니다. 회원이 탈퇴하면 함께 지워집니다.

## 2. 행동 기록 종류 (`learner_events.type`)

| type | 언제 | props |
|---|---|---|
| `visit` | 브라우저 탭에서 처음 서비스 화면을 열 때 (탭당 1번) | `path`, `src`(qr/link), `referrer`(다른 사이트 도메인), `device`, `os`, `browser` |
| `login` | 이메일 로그인·가입 직후, Google 로그인 후 | `method`(email/google), `device`, `os`, `browser` |
| `report_view` | 리포트에서 나가거나 다른 탭으로 갈 때 (여러 번 올 수 있음 → 더해서 씀) | `dwell_sec`(실제로 보고 있던 초), `max_scroll_pct` |
| `report_section_open` | 리포트의 '대화 전문'을 펼칠 때 | `section` |
| `report_feedback` | 리포트 끝 👍/👎 (마지막 것이 최종 답) | `agree`, `comment`(선택) |
| `realism_rating` | "실제 고객과 얼마나 비슷했나요?" (리포트 대기 중 또는 리포트 끝) | `score` 1~5 |
| `voice_segments` | 음성 통화 1회 연결이 끝날 때 (상시 서버) | `segments`: [{`start_ms`, `end_ms`, `during_ai`}] |

## 3. 계산 규칙 (`packages/shared/src/analytics.ts`)

- **응답 시간**: 고객 말 → 그 뒤 수강생의 첫 말까지 초. **텍스트 모드만** (음성은 자막 변환 시간이 섞여 비움).
- **발화 길이**: 공백·문장부호를 뺀 글자 수.
- **말 비율**: 수강생 글자 ÷ (수강생 + 고객 글자).
- **쿠션어·사과·공감·금지 표현**: 띄어쓰기를 무시하고 포함 여부를 찾음. 모든 분류를 통틀어 긴 표현부터 찾고 찾은 부분은 지움 (예: '죄송합니다만'은 쿠션어로만 셈).
- **필러**: '음·어·아'는 혼자 쓰이면 셈('음음'처럼 늘인 것 포함). '그·저·일단' 등은 뒤에 쉼표·말줄임표가 오거나 반복할 때만 셈.
- **○○ 비율(rate)**: 그 표현이 한 번이라도 들어간 수강생 발화의 %.
- **음성 지표**: 말한 시간 = 말 구간 길이의 합, 말 속도 = 수강생 글자 ÷ 말한 시간(글자/초), 끼어들기 = AI가 답을 만드는 중에 말을 시작한 횟수(AI 음성 재생이 끝나기 전 끼어든 일부는 빠질 수 있어 '대략'으로 봄).
- **자주 쓴 말 묶음(top_ngrams)**: 문장 안 2~3어절 묶음 중 2번 이상 쓴 것 40개. 사람별 말버릇은 분석 화면에서 다른 수강생과 비교해 골라냄.

규칙을 바꾸면 `ANALYZER_VERSION`을 올리세요. 표현 목록을 바꾸면 목록 지문(`lexicon_hash`)이 달라집니다. 둘 다 상시 서버가 2분마다 30개씩 지난 실습을 자동으로 다시 분석합니다.

## 4. 화면 (PR B · PR C)

| 화면 | 누가 | 내용 | 코드 |
|---|---|---|---|
| 관리자 → **표현 목록** (`/admin/lexicon`) | 관리자 | 분류별 표현 추가·켜기/끄기·삭제, 최근 실습 500개 기준 사용 횟수, '문장 넣어 보기' | `app/admin/lexicon`, `components/admin/LexiconManager.tsx`, `app/api/lexicon` |
| 교육 차수 → **📊 심화 분석** (`/instructor/cohorts/[id]/analytics`) | 담당 강사·관리자 | 참여·필수 완료율, 응대 습관(첫 시도→최근 시도), 많이 쓴 표현, 반 전체 반복 말, 재도전 점수 변화, 역량 변화, 자주 빠뜨리는 단계·안내, 시나리오 실제 난이도, 수강생별 습관, 수강생 구성 | `lib/cohort-analytics.ts` |
| 관리자 → **분석** (`/admin/analytics`) | 관리자 | 최근 차수 30개 비교표 | `app/admin/analytics` |

가입 퍼널·유입 경로·기기·비용 같은 운영 숫자는 서비스 화면 대신 **Looker Studio**(`docs/METABASE.md`의 읽기 전용 계정 + `analytics` 스키마)에서 봅니다.
