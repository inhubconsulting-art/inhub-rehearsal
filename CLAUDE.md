# 인허브 리허설 · 작업 규칙 (Claude용)

이 저장소에서 작업하는 Claude가 반드시 지키는 규칙입니다. 저장소 주인은 비개발자이므로 설명과 주석은 쉬운 한국어로 씁니다.

## 1. 브랜치와 배포 안전장치

- **main 브랜치에는 절대 직접 push하지 않습니다.** main에 합치면 실서비스(inhub-rehearsal.vercel.app)와 Railway 상시 서버가 바로 배포됩니다.
- 작업은 **dev 브랜치**(또는 dev에서 딴 `claude/...` 브랜치)에 올립니다. dev에 올리면 Vercel이 테스트 주소(Preview)를 만들어 주고, 실서비스에는 영향이 없습니다.
- dev → main 반영은 **Pull Request로만** 합니다. **PR의 Merge는 사람이 직접** 테스트 주소를 확인한 뒤 누릅니다. Claude는 Merge하지 않습니다.
- 수업 중에는 main 반영을 하지 않도록 PR 설명에 안내합니다.

## 2. DB 변경

- DB 구조 변경은 `supabase/migrations/` 에 **새 SQL 파일**로 추가합니다(기존 파일 수정 금지). 여러 번 실행해도 안전하게 작성합니다(`if not exists` 등).
- DB 변경은 자동 반영되지 않습니다. 해당 PR 설명 **맨 위**에 `⚠️ 배포 전에 Supabase SQL Editor에서 ○○.sql 먼저 실행`을 적습니다.
- 가능하면 현재 실서비스 코드와도 호환되게(칸 추가 위주로) 만들어, SQL을 먼저 실행해도 서비스가 깨지지 않게 합니다.

## 3. 비밀값

- `.env`, API 키, 비밀번호, 키 관리표(xlsx)는 저장소에 올리지 않습니다. 필요한 변수 목록은 `.env.example` 에만 적습니다.

## 4. 코드 규칙

- 모든 파일 맨 위에 `===== 쉬운 설명 =====` 주석(무엇/언제/리뷰 포인트)을 답니다.
- 화면에 날짜·시간을 쓸 때는 `apps/web/src/lib/format.ts` 의 `fmtDate`/`fmtDateTime` 만 씁니다(서버가 UTC라 한국 시간 지정 필수).
- Supabase 실시간 연결 이름은 `apps/web/src/lib/realtime.ts` 의 `uniqueTopic` 을 씁니다. 접속 현황(presence)만 예외로 `setupWithRetry` 를 씁니다.
- 성공·실패 알림은 `components/Toast.tsx` 의 `useToast` 를 씁니다.
- 커밋 메시지는 한국어로 무엇을 바꿨는지 씁니다.
