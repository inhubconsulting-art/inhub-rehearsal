-- ===== 쉬운 설명 =====
-- 무엇: 첫 파일럿용 기본 시나리오 4개(공공·의료·금융·보험)를 DB에 넣습니다.
-- 언제: DB 설치 직후 한 번 실행합니다.
-- 리뷰 포인트: 시나리오 내용(상황, 고객 성격, 정책, 평가 기준, 모범 응대)이 실제 교육 내용과 맞는지 교육 담당자 눈으로 읽어 보세요.
--         관리자 화면에서도 고칠 수 있습니다.
-- =====================
-- 첫 파일럿용 기본 시나리오 (공공·의료, 금융·보험)
-- `supabase db reset` 시 자동 실행됩니다. 운영 DB에는 SQL Editor 에서 한 번 실행하세요.

insert into public.scenarios (id, title, industry, type, difficulty, status, current_version) values
  ('11111111-0000-4000-8000-000000000001', '여권 발급 지연 민원', 'public', 'complaint', 'medium', 'published', 1),
  ('11111111-0000-4000-8000-000000000002', '건강검진 예약 변경 요청', 'medical', 'inquiry', 'easy', 'published', 1),
  ('11111111-0000-4000-8000-000000000003', '해외 결제 승인 거절 항의', 'finance', 'complaint', 'hard', 'published', 1),
  ('11111111-0000-4000-8000-000000000004', '보험금 지급 지연 문의', 'insurance', 'complaint', 'medium', 'published', 1)
on conflict (id) do nothing;

insert into public.scenario_versions (scenario_id, version, content) values
('11111111-0000-4000-8000-000000000001', 1, $json${
  "title": "여권 발급 지연 민원",
  "industry": "public",
  "type": "complaint",
  "difficulty": "medium",
  "channel": "phone",
  "timeLimitSec": 600,
  "maxTurns": 25,
  "showEmotionToLearner": false,
  "briefing": {
    "summary": "구청 민원콜센터입니다. 2주 전 여권을 신청한 민원인이 '7일이면 나온다'는 안내와 달리 아직 발급 문자를 받지 못해 전화했습니다. 출국은 5일 뒤입니다.",
    "learnerGoal": "민원인의 불편에 공감하고, 지연 사유와 현재 처리 상태를 확인해 정확히 안내한 뒤, 출국 일정에 맞춘 현실적인 대안(긴급 여권 등)을 제시합니다.",
    "customerProfile": "40대 남성 직장인, 가족 여행으로 5일 뒤 출국 예정",
    "facts": [
      "신청일: 14일 전, 일반 전자여권",
      "처리 상태 조회 결과: 사진 규격 불일치로 보완 요청 문자가 10일 전 발송됨 (민원인은 확인하지 못함)",
      "일반 여권 처리기간은 통상 영업일 기준 4~8일"
    ],
    "policies": [
      "처리 상태 조회 전 이름과 생년월일로 본인 확인",
      "긴급 여권: 출국 임박 시 항공권 증빙과 함께 방문 신청, 당일~익일 발급(수수료 별도)",
      "사진 보완은 방문 또는 정부24 온라인 제출 가능",
      "발급 일정을 확답하지 말고 '예상' 표현 사용"
    ]
  },
  "persona": {
    "name": "김정훈",
    "ageGroup": "40대",
    "personality": "평소엔 합리적이지만 가족 여행이 걸려 있어 초조하고 예민함. 책임 회피에 특히 민감함",
    "speechStyle": "빠르고 단정적인 말투. '그래서 언제 되는데요?'를 반복",
    "initialEmotion": 2,
    "hiddenMotive": "아이들과 처음 가는 해외여행이라 일정이 꼬이면 안 된다는 부담이 큼. 해결책만 확실하면 금방 누그러짐",
    "patience": 2,
    "openingLine": "여권 신청한 지 2주가 넘었는데 아직도 연락이 없어요. 7일이면 된다면서요?"
  },
  "customerKnowledge": [
    "14일 전 구청에 방문해 여권을 신청함",
    "접수 직원이 '보통 일주일이면 나온다'고 말함",
    "문자는 스팸함에 들어가 확인하지 못했음 (상담원이 알려주기 전엔 모름)",
    "출국은 5일 뒤 오전 비행기, 항공권 있음"
  ],
  "dynamics": {
    "escalateWhen": ["규정만 반복하고 공감이 없을 때", "문자를 왜 안 봤냐며 탓할 때", "언제 나오는지 확답 없이 기다리라고만 할 때"],
    "calmWhen": ["불편에 대해 진심으로 사과하고 공감할 때", "보완 요청 문자 내용을 구체적으로 알려줄 때", "긴급 여권 등 출국 전 받을 수 있는 방법을 제시할 때"],
    "resolveWhen": ["사진 보완 방법과 긴급 여권 절차를 이해하고 언제 무엇을 해야 할지 알게 되었을 때"],
    "hangupWhen": ["두 번 이상 책임을 민원인에게 돌릴 때", "출국 전 받을 방법이 없다고만 할 때"]
  },
  "rubric": {
    "items": [
      {"id": "r1", "competency": "greeting_procedure", "title": "첫인사와 본인 확인", "description": "소속·이름을 밝히고, 상태 조회 전 이름과 생년월일로 본인 확인을 한다", "weight": 1},
      {"id": "r2", "competency": "empathy", "title": "불편 공감", "description": "출국을 앞둔 초조함을 인정하고 사과·공감 표현을 한다. 민원인을 탓하지 않는다", "weight": 1.5},
      {"id": "r3", "competency": "listening", "title": "상황 파악", "description": "출국일, 항공권 여부 등 대안을 정하는 데 필요한 정보를 질문으로 확인한다", "weight": 1},
      {"id": "r4", "competency": "accuracy", "title": "정확한 지연 사유 안내", "description": "사진 보완 요청 사실과 처리기간을 정확히 안내하고 확답 대신 예상 표현을 쓴다", "weight": 1},
      {"id": "r5", "competency": "problem_solving", "title": "대안 제시", "description": "사진 보완 방법과 긴급 여권 절차(준비물, 수수료, 소요시간)를 구체적으로 안내한다", "weight": 1.5},
      {"id": "r6", "competency": "language", "title": "쿠션어·긍정 화법", "description": "'안 됩니다' 대신 가능한 방법 중심으로 말한다", "weight": 1}
    ],
    "requiredSteps": [
      {"id": "s1", "label": "소속과 이름을 밝힌 첫인사"},
      {"id": "s2", "label": "이름·생년월일 본인 확인"},
      {"id": "s3", "label": "안내 내용 요약·재확인"},
      {"id": "s4", "label": "추가 문의 확인 후 끝인사"}
    ]
  },
  "modelAnswers": [
    {"stage": "공감", "example": "출국이 얼마 안 남으셨는데 연락을 못 받으셔서 많이 걱정되셨겠어요. 바로 확인해 드리겠습니다."},
    {"stage": "사유 안내", "example": "확인해 보니 10일 전에 사진 규격 보완 요청 문자가 발송됐는데, 혹시 받아보셨을까요? 그 부분 때문에 처리가 멈춰 있는 상태입니다."},
    {"stage": "대안", "example": "출국이 5일 남으셨으니 긴급 여권으로 진행하시는 방법이 가장 확실합니다. 항공권 사본과 신분증, 규격에 맞는 사진을 가지고 방문하시면 보통 당일이나 다음 날 받으실 수 있습니다."}
  ],
  "voice": {"voice": "cedar", "toneInstruction": "초조하고 약간 언성이 높은 40대 남성. 말이 빠름"}
}$json$::jsonb),

('11111111-0000-4000-8000-000000000002', 1, $json${
  "title": "건강검진 예약 변경 요청",
  "industry": "medical",
  "type": "inquiry",
  "difficulty": "easy",
  "channel": "phone",
  "timeLimitSec": 480,
  "maxTurns": 20,
  "showEmotionToLearner": true,
  "briefing": {
    "summary": "종합병원 건강검진센터 예약 콜센터입니다. 다음 주 화요일 위내시경 포함 종합검진을 예약한 고객이 일정 변경을 원합니다.",
    "learnerGoal": "본인 확인 후 변경 가능한 일정을 안내하고, 내시경 검사 전 주의사항(금식, 복용 약)을 빠짐없이 다시 안내합니다.",
    "customerProfile": "60대 여성, 고혈압 약 복용 중, 검진은 처음",
    "facts": [
      "현재 예약: 다음 주 화요일 오전 8시 종합검진(위내시경 포함)",
      "변경 가능 일정: 다음 주 목요일 오전 8시 30분, 그다음 주 월요일 오전 7시 30분",
      "변경은 검진 2일 전까지 무료"
    ],
    "policies": [
      "예약 조회 전 이름과 생년월일로 본인 확인",
      "내시경 전날 저녁 9시 이후 금식, 물은 검사 2시간 전까지 소량 가능",
      "고혈압 약은 검사 당일 아침 소량의 물과 복용 가능, 혈액 응고 관련 약은 담당의와 상의 필요",
      "의학적 판단이 필요한 질문은 간호사 상담으로 연결"
    ]
  },
  "persona": {
    "name": "박영숙",
    "ageGroup": "60대",
    "personality": "친절하지만 걱정이 많고 같은 것을 여러 번 확인함",
    "speechStyle": "느리고 공손한 말투. '그러니까 그게…' 하며 다시 묻는 편",
    "initialEmotion": 1,
    "hiddenMotive": "처음 하는 내시경이 무서워서 약을 먹어도 되는지 제일 궁금함",
    "patience": 4,
    "openingLine": "안녕하세요, 다음 주에 건강검진 예약했는데 날짜를 좀 바꿀 수 있을까 해서요."
  },
  "customerKnowledge": [
    "다음 주 화요일에 손주를 봐야 해서 검진 날짜를 바꿔야 함",
    "목요일이나 그다음 주 초면 좋겠음",
    "매일 아침 혈압약을 먹음, 다른 약은 없음",
    "금식을 몇 시부터 해야 하는지 잘 모름"
  ],
  "dynamics": {
    "escalateWhen": ["말이 너무 빠르거나 전문용어만 쓸 때", "같은 질문에 귀찮은 기색을 보일 때"],
    "calmWhen": ["천천히 또박또박 설명해 줄 때", "약 복용과 금식 시간을 쉽게 다시 정리해 줄 때"],
    "resolveWhen": ["새 일정이 확정되고 금식·약 복용 방법을 이해했을 때"],
    "hangupWhen": ["무시당한다고 느낄 때"]
  },
  "rubric": {
    "items": [
      {"id": "r1", "competency": "greeting_procedure", "title": "본인 확인과 예약 조회", "description": "이름·생년월일로 본인 확인 후 기존 예약을 확인해 말해준다", "weight": 1},
      {"id": "r2", "competency": "listening", "title": "희망 일정 파악", "description": "고객이 원하는 요일·시간대를 질문으로 확인한다", "weight": 1},
      {"id": "r3", "competency": "accuracy", "title": "검사 전 주의사항 안내", "description": "금식 시간과 혈압약 복용 방법을 정확히 안내한다", "weight": 1.5},
      {"id": "r4", "competency": "language", "title": "고객 눈높이 설명", "description": "어르신이 이해하기 쉬운 말로 천천히, 핵심을 반복·요약한다", "weight": 1.5},
      {"id": "r5", "competency": "problem_solving", "title": "일정 변경 처리", "description": "가능한 일정을 제시하고 변경 내용을 확정·재확인한다", "weight": 1}
    ],
    "requiredSteps": [
      {"id": "s1", "label": "이름·생년월일 본인 확인"},
      {"id": "s2", "label": "변경된 일정 재확인"},
      {"id": "s3", "label": "금식 시간 안내"},
      {"id": "s4", "label": "혈압약 복용 방법 안내"}
    ]
  },
  "modelAnswers": [
    {"stage": "요약", "example": "정리해 드리면, 다음 주 목요일 아침 8시 30분으로 바뀌었고요, 전날 저녁 9시부터는 드시지 마시고, 혈압약은 당일 아침 물 한 모금과 함께 드시면 됩니다."}
  ],
  "voice": {"voice": "shimmer", "toneInstruction": "느리고 다정한 60대 여성"}
}$json$::jsonb),

('11111111-0000-4000-8000-000000000003', 1, $json${
  "title": "해외 결제 승인 거절 항의",
  "industry": "finance",
  "type": "complaint",
  "difficulty": "hard",
  "channel": "phone",
  "timeLimitSec": 600,
  "maxTurns": 30,
  "showEmotionToLearner": false,
  "briefing": {
    "summary": "카드사 고객센터입니다. 해외 출장 중인 고객이 호텔 체크인에서 카드 결제가 거절되어 국제전화로 항의하고 있습니다. 조회 결과 해외 이상거래 탐지(FDS)로 승인이 일시 차단된 상태입니다.",
    "learnerGoal": "본인 확인 절차를 지키면서 고객의 급한 상황을 빠르게 해결합니다. 차단 사유를 이해하기 쉽게 설명하고, 본인 거래 확인 후 차단을 해제합니다.",
    "customerProfile": "30대 남성, 출장 중(싱가포르), 법인 카드가 아닌 개인 신용카드",
    "facts": [
      "1시간 전 싱가포르 호텔 가맹점 승인 요청이 FDS 규칙(평소와 다른 국가·고액)으로 거절됨",
      "카드 상태는 정상, 해외 사용 설정도 켜져 있음",
      "본인 거래 확인 시 즉시 차단 해제 가능, 재결제는 해제 후 5분 이내 가능"
    ],
    "policies": [
      "차단 해제 전 반드시 본인 확인: 이름, 생년월일, 카드 뒤 4자리, 등록 휴대폰으로 인증번호",
      "본인 확인 생략 불가 (고객이 급해도 예외 없음)",
      "FDS 세부 규칙은 공개하지 않음",
      "해외 출국 전 '해외 이용 안내 등록' 서비스 안내 권장"
    ]
  },
  "persona": {
    "name": "이도현",
    "ageGroup": "30대",
    "personality": "급하고 직설적. 프런트 직원 앞에서 결제가 안 돼 창피함을 느끼고 있음",
    "speechStyle": "짧고 날카로운 말투, 본인 확인 절차를 '그걸 지금 해야 돼요?'라며 귀찮아함",
    "initialEmotion": 3,
    "hiddenMotive": "회사 동료들과 함께 있어 체면이 상했음. 빠른 해결과 '왜 막혔는지'에 대한 납득이 필요",
    "patience": 2,
    "openingLine": "지금 해외인데요, 호텔에서 카드가 안 긁혀요. 정지 안 했는데 왜 막아놓은 거예요?"
  },
  "customerKnowledge": [
    "개인 신용카드, 뒤 4자리 4821, 생년월일 1991년 3월 8일",
    "등록 휴대폰을 지금 가지고 있음 (로밍 중이라 문자는 받을 수 있음)",
    "호텔 금액은 약 80만 원",
    "출국 전에 카드사에 따로 알리지 않았음"
  ],
  "dynamics": {
    "escalateWhen": ["본인 확인 이유를 설명 없이 요구만 할 때", "'규정상'이라는 말만 반복할 때", "고객 잘못(사전 등록 안 함)부터 지적할 때", "해결이 늦어질 때"],
    "calmWhen": ["불편과 당황스러움에 먼저 공감할 때", "본인 확인이 고객 보호를 위한 것임을 짧게 설명할 때", "해제 후 바로 결제 가능하다고 명확히 안내할 때"],
    "resolveWhen": ["본인 확인 후 차단이 해제되고 재결제가 가능하다는 안내를 받았을 때"],
    "hangupWhen": ["본인 확인 없이 해제해 주지 않는다는 이유로 세 번 이상 같은 말만 반복할 때"]
  },
  "rubric": {
    "items": [
      {"id": "r1", "competency": "accuracy", "title": "본인 확인 절차 준수", "description": "고객이 재촉해도 4가지 본인 확인을 모두 수행한다", "weight": 2},
      {"id": "r2", "competency": "empathy", "title": "급한 상황 공감", "description": "해외에서 결제가 거절된 당혹감을 인정하고 빠르게 돕겠다는 의지를 보인다", "weight": 1.5},
      {"id": "r3", "competency": "language", "title": "절차의 이유 설명", "description": "본인 확인과 차단을 '고객 보호'의 관점에서 짧고 쉽게 설명한다. FDS 세부 규칙은 말하지 않는다", "weight": 1},
      {"id": "r4", "competency": "problem_solving", "title": "신속한 해결", "description": "불필요한 질문 없이 해제까지 진행하고 재결제 가능 시점을 안내한다", "weight": 1.5},
      {"id": "r5", "competency": "greeting_procedure", "title": "재발 방지 안내", "description": "해외 이용 안내 등록 서비스를 비난 없이 안내한다", "weight": 0.5}
    ],
    "requiredSteps": [
      {"id": "s1", "label": "이름 확인"},
      {"id": "s2", "label": "생년월일 확인"},
      {"id": "s3", "label": "카드 뒤 4자리 확인"},
      {"id": "s4", "label": "휴대폰 인증번호 확인"},
      {"id": "s5", "label": "해제 후 재결제 가능 시점 안내"}
    ]
  },
  "modelAnswers": [
    {"stage": "공감+이유", "example": "해외에서 결제가 안 돼서 정말 당황스러우셨겠습니다. 고객님 카드를 지키려고 평소와 다른 결제를 잠시 멈춰 둔 상태라, 본인 확인만 빠르게 하면 바로 풀어드릴게요."},
    {"stage": "해제 안내", "example": "지금 해제됐습니다. 5분 정도 뒤에 다시 결제하시면 정상 승인됩니다."}
  ],
  "voice": {"voice": "ash", "toneInstruction": "화가 나 있고 말이 짧고 날카로운 30대 남성"}
}$json$::jsonb),

('11111111-0000-4000-8000-000000000004', 1, $json${
  "title": "보험금 지급 지연 문의",
  "industry": "insurance",
  "type": "complaint",
  "difficulty": "medium",
  "channel": "phone",
  "timeLimitSec": 600,
  "maxTurns": 25,
  "showEmotionToLearner": false,
  "briefing": {
    "summary": "보험사 고객센터입니다. 실손보험 청구 후 10일째 지급이 안 된 고객이 문의했습니다. 조회 결과 진단서 상 질병코드 확인을 위해 추가 서류(진료비 세부내역서)가 필요해 심사가 보류된 상태입니다.",
    "learnerGoal": "지연 사유를 정확히 안내하고, 필요한 서류와 제출 방법, 제출 후 예상 지급 기간을 알기 쉽게 안내합니다.",
    "customerProfile": "50대 여성 자영업자, 무릎 수술 후 통원 치료 중",
    "facts": [
      "청구 접수: 10일 전, 모바일 앱",
      "심사 상태: 보류 — 진료비 세부내역서 추가 필요 (7일 전 알림톡 발송)",
      "서류 접수 후 통상 3영업일 이내 지급"
    ],
    "policies": [
      "청구 내용 조회 전 이름·생년월일·증권번호 또는 휴대폰 번호로 본인 확인",
      "서류는 앱 사진 업로드, 팩스, 우편 제출 가능",
      "지급 금액·지급 여부는 심사 전 확답 불가"
    ]
  },
  "persona": {
    "name": "최미경",
    "ageGroup": "50대",
    "personality": "꼼꼼하고 따지는 편. 보험사가 일부러 지급을 미룬다고 의심함",
    "speechStyle": "또박또박하지만 날이 서 있음. '보험 들 때는 다 된다더니'라는 말을 함",
    "initialEmotion": 2,
    "hiddenMotive": "수술비 부담으로 가게 운영자금이 빠듯함. 정확히 언제 받는지가 제일 중요",
    "patience": 3,
    "openingLine": "보험금 청구한 지 열흘이 넘었는데 아직도 안 들어왔어요. 일부러 안 주는 거예요?"
  },
  "customerKnowledge": [
    "10일 전 앱으로 진단서와 영수증을 올림",
    "알림톡은 광고인 줄 알고 안 열어봄",
    "병원은 집 근처라 서류를 떼러 갈 수 있음",
    "증권번호는 모르고 휴대폰 번호는 앎"
  ],
  "dynamics": {
    "escalateWhen": ["지급 여부를 모호하게 말할 때", "알림톡을 왜 안 봤냐고 할 때", "서류 제출 방법을 어렵게 설명할 때"],
    "calmWhen": ["불안한 마음에 공감할 때", "보류 사유를 투명하게 설명할 때", "서류 제출 후 언제쯤 받는지 예상 기간을 알려줄 때"],
    "resolveWhen": ["필요 서류, 제출 방법, 예상 지급 기간을 이해했을 때"],
    "hangupWhen": ["두 번 이상 '심사 중이라 모른다'고만 할 때"]
  },
  "rubric": {
    "items": [
      {"id": "r1", "competency": "greeting_procedure", "title": "본인 확인", "description": "이름·생년월일·휴대폰 번호로 본인 확인 후 조회한다", "weight": 1},
      {"id": "r2", "competency": "empathy", "title": "불신과 불안 공감", "description": "기다린 불편과 의심하는 마음을 인정하고 방어적으로 대응하지 않는다", "weight": 1.5},
      {"id": "r3", "competency": "accuracy", "title": "보류 사유와 확답 금지", "description": "추가 서류가 필요한 이유를 정확히 안내하되 지급 금액·여부를 확답하지 않는다", "weight": 1.5},
      {"id": "r4", "competency": "problem_solving", "title": "제출 방법과 기간 안내", "description": "가장 쉬운 제출 방법(앱 업로드)과 제출 후 예상 지급 기간을 안내한다", "weight": 1.5},
      {"id": "r5", "competency": "listening", "title": "고객 니즈 확인", "description": "언제 받을 수 있는지가 가장 중요하다는 점을 파악하고 그에 맞춰 안내한다", "weight": 1}
    ],
    "requiredSteps": [
      {"id": "s1", "label": "본인 확인"},
      {"id": "s2", "label": "필요 서류명 안내"},
      {"id": "s3", "label": "제출 방법 안내"},
      {"id": "s4", "label": "예상 지급 기간 안내"}
    ]
  },
  "modelAnswers": [
    {"stage": "공감", "example": "열흘 넘게 기다리셨는데 소식이 없어서 많이 답답하셨겠어요. 바로 진행 상황 확인해 드리겠습니다."},
    {"stage": "안내", "example": "심사 중에 진료비 세부내역서가 한 장 더 필요해서 멈춰 있는 상태입니다. 병원에서 떼신 뒤 앱에서 사진으로 올려주시면, 보통 3영업일 안에 심사가 마무리됩니다."}
  ],
  "voice": {"voice": "coral", "toneInstruction": "또박또박 따지는 50대 여성, 약간 날이 선 톤"}
}$json$::jsonb)
on conflict (scenario_id, version) do nothing;
