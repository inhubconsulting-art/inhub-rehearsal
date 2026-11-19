# Metabase 연결 안내 (운영 분석용)

> 쉬운 설명: 운영자가 가입 퍼널·유입 경로·비용 같은 숫자를 직접 표와 차트로 보기 위한 도구입니다.
> 서비스 화면과는 별개이고, 개인정보를 뺀 분석용 표만 읽습니다.

## 1. Supabase 준비 (한 번만)
1. SQL Editor에서 `supabase/migrations/20261119000000_metabase_readonly.sql` 실행
2. 같은 곳에서 비밀번호 설정 (파일에 저장하지 말고 직접 입력)
   ```sql
   alter role metabase_ro with password '여기에-긴-비밀번호';
   ```

## 2. Railway에 Metabase 설치
1. Railway → New → Template → "Metabase" 배포 (Metabase 설정용 DB가 함께 생김)
2. 배포 주소로 접속해 관리자 계정 생성 (강한 비밀번호)

## 3. Metabase에서 Supabase 연결
Supabase 프로젝트 → Connect → **Session pooler** 정보를 보고 입력합니다.

| 칸 | 값 |
|---|---|
| 데이터베이스 종류 | PostgreSQL |
| 호스트 | `aws-0-….pooler.supabase.com` |
| 포트 | 5432 |
| DB 이름 | postgres |
| 사용자 | `metabase_ro.<프로젝트 참조값>` |
| 비밀번호 | 1-2에서 정한 비밀번호 |
| SSL 사용 | 켜기 |
| 스키마 | `analytics` 만 선택 |

연결 후: 관리자 설정 → 지역화 → **보고서 시간대 Asia/Seoul**.

## 4. 볼 수 있는 표 (`analytics` 스키마)
| 표 | 한 줄 = |
|---|---|
| users | 사용자 1명 (이름·이메일 없음) |
| cohorts | 교육 차수 1개 (`kind`: class / practice / preview) |
| cohort_scenarios, scenarios | 차수 구성, 시나리오 |
| enrollments | 교육 참여 1건 (`entry_source`: qr/link/code) |
| sessions | 실습 1회 (시간·종료 사유·이관 등) |
| evaluations, competency_scores | 총점·등급, 역량별 점수 |
| session_analytics, utterances | 대화 분석 (쿠션어·말버릇·응답 시간 등) |
| events | 행동 기록 (접속·로그인·리포트 열람·👍/👎·현실감) |
| pass_ledger | 이용권 지급·사용 |
| phrase_lexicon | 분석 기준 표현 목록 |

## 주의
- Metabase 계정은 운영자에게만 만드세요. 이 연결로는 수강생 전체 통계를 볼 수 있습니다.
- 개인을 특정해야 할 때(이름 확인 등)는 서비스의 관리자 화면을 쓰세요.
