# 인허브 리허설

CS 교육 실습 시간에 수강생 20~30명이 동시에 AI 고객과 텍스트·음성으로 응대를 연습하고, 대화가 끝나면 맞춤 리포트를 받는 서비스입니다. 강사는 대시보드에서 반 전체 진행 상황과 수강생별 결과를 실시간으로 보고 디브리핑에 바로 활용합니다.

## 구성

| 구성 요소 | 위치 | 배포 |
| --- | --- | --- |
| 웹앱 (수강생·강사·관리자 화면 + API) | `apps/web` (Next.js) | Vercel |
| 상시 서버 (음성 대화 기록, 리포트 생성) | `apps/worker` (Node.js + Fastify) | Railway 또는 Render |
| 공통 코드 (시나리오·평가 스키마, AI 지시문) | `packages/shared` | — |
| DB·로그인·실시간·대기열 | `supabase/` (마이그레이션, 기본 시나리오) | Supabase (서울 리전) |

음성은 수강생 브라우저와 OpenAI가 WebRTC로 직접 연결됩니다. 연결 협상만 웹앱 서버를 거치고, 상시 서버가 같은 통화에 사이드밴드로 붙어 전사문을 저장하고 고객 감정을 판단하며 시간·턴 제한 시 통화를 끊습니다.

---

## 구축 후 처리할 일 (가입·연동 체크리스트)

순서대로 진행하세요. 각 단계에서 얻는 값은 `.env` 에 들어갑니다.

### 1. 계정 가입

- [ ] **GitHub**: 이 폴더를 저장소로 올립니다 (Vercel·Railway가 여기서 코드를 가져감).
- [ ] **Supabase** (supabase.com): 조직 생성. 운영은 **Pro 요금제** 권장 (실시간 동시 연결 500개, 무료는 200개·일시정지 있음).
- [ ] **OpenAI Platform** (platform.openai.com): 결제 수단 등록 후 API 키 발급. 사용 등급(Usage tier)에 따라 동시 처리량이 달라지므로, 교육 전 등급과 한도를 확인하세요.
- [ ] **Vercel** (vercel.com): GitHub 계정으로 가입.
- [ ] **Railway** (railway.app) 또는 **Render** (render.com): GitHub 계정으로 가입.

### 2. Supabase 프로젝트 만들기

1. [ ] 새 프로젝트 생성 → Region: **Northeast Asia (Seoul)**.
2. [ ] Settings → API 에서 아래 값을 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 외부 공유 금지)
3. [ ] DB 만들기 (둘 중 하나)
   - **CLI 사용**: `npx supabase link --project-ref <프로젝트 ref>` → `npx supabase db push` → SQL Editor 에서 `supabase/seed.sql` 실행
   - **화면에서**: SQL Editor 에 `supabase/migrations/20261112000000_init.sql` 전체를 붙여 실행 → 이어서 `supabase/seed.sql` 실행
4. [ ] Authentication → Sign In / Providers → Email: 교육 당일 빠른 가입을 원하면 **Confirm email 끄기**.
5. [ ] Authentication → URL Configuration: Site URL 을 웹앱 주소(Vercel 배포 후 받는 주소)로, Redirect URLs 에 `https://<웹앱 주소>/auth/callback` 추가.

### 3. 환경변수 파일 만들기

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
```

두 파일에 2번에서 복사한 값, OpenAI API 키, `WORKER_SHARED_SECRET`(아무 긴 무작위 문자열, 두 서버에 같은 값)을 채웁니다.

### 4. 내 컴퓨터에서 실행해 보기 (선택)

Node.js 22 이상 필요.

```bash
npm install
npm run dev:worker   # 터미널 1 → http://localhost:8787/health
npm run dev:web      # 터미널 2 → http://localhost:3000
```

### 5. 배포

**상시 서버 (Railway 기준)**
1. [ ] New Project → Deploy from GitHub repo → 이 저장소 선택
2. [ ] Settings → Start Command: `npm run start -w @inhub/worker`
3. [ ] Variables 에 `.env` 의 값 입력 (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `WORKER_SHARED_SECRET`, `OPENAI_*` 모델 설정, `EVAL_CONCURRENCY`)
4. [ ] Networking → Generate Domain → 받은 주소를 웹앱의 `WORKER_URL` 로 사용
5. [ ] `https://<워커 주소>/health` 가 `{"ok":true,...}` 를 돌려주는지 확인

**웹앱 (Vercel)**
1. [ ] Add New → Project → 이 저장소 선택
2. [ ] Root Directory: `apps/web`
3. [ ] Environment Variables 에 `.env` 값 전체 + `WORKER_URL` 입력
4. [ ] Settings → Functions → Region: **Seoul (icn1)**
5. [ ] Deploy → 받은 주소를 2-5 단계의 Supabase URL 설정에 반영

### 6. 첫 관리자 지정

웹앱에서 회원가입한 뒤, Supabase SQL Editor 에서 실행:

```sql
update public.profiles set role = 'admin' where email = '내이메일@example.com';
```

이후 강사 권한은 웹앱의 **사용자** 메뉴에서 줄 수 있습니다.

### 7. 동작 확인

- [ ] 관리자로 **시나리오** → 기본 시나리오 하나 열기 → **테스트 (텍스트)** 로 대화 후 리포트가 1분 안에 나오는지
- [ ] **테스트 (음성)** 로 통화 → 대화가 화면에 자막으로 쌓이는지 (안 쌓이면 상시 서버 로그와 `WORKER_URL` 확인)
- [ ] 강사 대시보드에서 교육 차수 생성 → 다른 브라우저(시크릿 창)에서 수강생으로 가입·입장 → 실습 시작 → 대시보드에 실시간 반영되는지
- [ ] 교육 전 30명 동시 부하 테스트 (아래 'PoC 확인 항목')

---

## 사용 흐름

1. **운영 관리자**: 시나리오 작성·테스트 → 공개
2. **강사**: 교육 차수 생성(시나리오·대화 방식·제한 시간 선택) → 입장 코드/QR 공유 → 실습 시작
3. **수강생**: 가입·로그인 → 입장 코드 입력(동의) → 시나리오 브리핑 확인 → 음성 또는 텍스트로 응대 → 리포트 확인 → 재도전
4. **강사**: 실시간 탭에서 도움 필요한 수강생 확인·대화 열람 → 실습 종료 → 분석 탭에서 AI 요약 생성 → 발표 화면으로 디브리핑 → Excel·리포트 일괄 인쇄

## PRD 요구사항 대응

| 영역 | 구현 위치 |
| --- | --- |
| 입장·세션 (L-01~05) | `/learn`, `/api/join`, `/api/sessions` |
| 브리핑·대화 (L-10~27) | `/learn/[cohortId]/scenarios/[id]`, `components/learner/Conversation.tsx`, `useVoiceCall.ts`, `/api/sessions/[id]/messages`, `/voice` |
| 리포트 (L-30~32, R-01~06) | `/learn/report/[id]`, `apps/worker/src/jobs.ts`, `components/report/ReportView.tsx` |
| 시나리오 관리 (S-01~05) | `/admin/scenarios`, `components/admin/ScenarioEditor.tsx` |
| 강사 대시보드 (A-01~25) | `/instructor`, `components/instructor/CohortDashboard.tsx`, `/present`, `/print`, `/api/cohorts/[id]/export` |
| 운영·권한 (A-30~32) | `/admin/users`, `/admin/usage`, `audit_logs` 테이블, RLS 정책 |

PRD와 다르게 구현한 부분:
- **리포트 PDF**: 서버에서 PDF 파일을 만드는 대신 인쇄용 화면을 제공하고 브라우저의 'PDF로 저장'을 씁니다 (개별·일괄 모두).
- **음성 연결**: OpenAI Agents SDK 대신 브라우저 표준 WebRTC를 직접 사용합니다. 서버가 통화를 시작하는 방식(OpenAI 'unified interface')이어야 사이드밴드 연결이 안정적이라는 개발자 보고가 있어 이렇게 했습니다.
- **고객사 담당자 화면(P2)·매뉴얼 기반 시나리오 자동 생성(P2)·강사 실시간 힌트(P2)** 는 이번 범위에서 제외했습니다.

## PoC 확인 항목

1. 음성 사이드밴드: 통화 중 전사문이 순서대로 저장되는지, 고객이 대화를 끝내면 통화가 자동 종료되는지
2. 동시 40개 음성 세션 + 리포트 생성을 상시 서버 1대가 감당하는지 (`EVAL_CONCURRENCY` 조정)
3. 음성 모델 비교: `OPENAI_REALTIME_MODEL` 을 `gpt-realtime-2.1` / `gpt-realtime-2.1-mini` 로 바꿔 한국어 품질·비용 비교
4. 텍스트 대화 첫 응답 속도: 느리면 `OPENAI_CHAT_MODEL` 을 더 빠른 모델로, `OPENAI_REASONING_EFFORT` 를 `minimal` 로

## 비용 추정

`/admin/usage` 는 토큰 사용량에 `apps/web/src/lib/cost.ts` 의 단가를 곱한 **추정치**입니다. 단가는 `PRICE_*` 환경변수로 바꿀 수 있으며, 실제 청구액은 OpenAI 대시보드에서 확인하세요.
#   i n h u b - r e h e a r s u l  
 #   i n h u b - r e h e a r s u l  
 #   i n h u b - r e h e a r s u l  
 #   i n h u b - r e h e a r s a l  
 #   i n h u b - r e h e a r s a l  
 