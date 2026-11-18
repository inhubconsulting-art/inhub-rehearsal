-- ===== 쉬운 설명 =====
-- 무엇: 대화 종료 규칙과 연결·이관 기능에 필요한 칸 2개를 sessions 표에 추가합니다.
--   ① resolved_at : 고객 용건에 모두 답이 나왔다고 판단한 시각. 이때부터 AI 고객에게 '인사하고 끝내라'는 신호를 주고,
--                   그래도 2턴 안에 끝나지 않으면 '문제 해결'로 자동 종료합니다.
--   ② handoff     : 연결·이관 기록. {"status": "pending"} = 고객이 연결을 받아들이고 기다리는 중,
--                   {"status": "done", "target": 연결한 곳, "memo": 인계 메모, "at": 시각} = 수강생이 연결·이관 버튼으로 마침.
-- 언제: 이 기능을 main 에 반영하기 '전에' Supabase SQL Editor 에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.
-- 리뷰 포인트: 칸 추가만 하므로 먼저 실행해도 지금 서비스는 그대로 동작합니다.
-- =====================

alter table public.sessions add column if not exists resolved_at timestamptz;
alter table public.sessions add column if not exists handoff jsonb;
