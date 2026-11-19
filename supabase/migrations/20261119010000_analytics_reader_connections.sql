-- ===== 쉬운 설명 =====
-- 무엇: 분석 도구용 읽기 전용 계정(metabase_ro)의 동시 접속 한도를 5 → 20으로 늘립니다.
--      Looker Studio는 차트·데이터 소스마다 접속을 여러 개 열어서 5개로는 'too many connections' 오류가 납니다.
-- 언제: Looker Studio 연결 전에 SQL Editor에서 실행. 여러 번 실행해도 안전하고, 서비스에는 영향이 없습니다.
-- 리뷰 포인트: 한도는 Supabase 전체 접속 수 안에서 나눠 쓰므로 너무 크게 잡지 않습니다(20).
-- =====================
alter role metabase_ro connection limit 20;
