"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 로그인 화면 왼쪽의 서비스 소개 슬라이드. 여러 장면이 서서히 겹쳐 바뀌는(디졸브) 방식으로 5.5초마다 넘어갑니다.
 *      장면마다 사진(public/login/slide-1.jpg …)을 쓰고, 사진 파일이 없거나 열리지 않으면 서비스 화면을 본뜬 그림으로 대신 보여 줍니다.
 * 언제: 로그인·회원가입 화면 (넓은 화면에서만, 휴대폰에서는 숨김).
 * 리뷰 포인트:
 *  - 사진 바꾸는 법: apps/web/public/login/ 에 slide-1.jpg ~ slide-4.jpg 를 넣으면 됩니다. 지금 사진은 색감을 맞춘(파란 톤·살짝 흐림·입자감)
 *    버전이고, 새 사진도 같은 처리를 하려면 README 안내를 보세요. 문구는 아래 SLIDES 에서 고칩니다.
 *  - 사진은 사용 허락(라이선스)을 확인한 것만 넣으세요. 모델이 나오는 유료 스톡 사진은 구매 라이선스가 필요합니다.
 *  - 움직임 줄이기 설정을 켠 사용자에게는 자동으로 넘기지 않습니다. 마우스를 올리면 잠시 멈춥니다.
 * =====================
 */
import { useEffect, useState } from "react";
import clsx from "clsx";

type Art = "chat" | "voice" | "report" | "path";
const SLIDES: { image: string; title: string; desc: string; art: Art }[] = [
  { image: "/login/slide-1.jpg", art: "chat", title: "실제 고객처럼 반응하는 AI 고객", desc: "말투와 태도에 바로 반응하고, 상황마다 다른 고객을 만나요. 실전 같은 응대를 미리 연습하세요." },
  { image: "/login/slide-2.jpg", art: "voice", title: "헤드셋을 끼고, 전화하듯 음성으로", desc: "실제 통화처럼 말하고 들으며 연습해요. 머뭇거려도 고객이 기다려 줘요." },
  { image: "/login/slide-3.jpg", art: "report", title: "끝나면 바로 코칭 리포트", desc: "역량별 점수, 빠뜨린 안내, '이렇게 말해 보세요'까지. 무엇을 고칠지 바로 보여요." },
  { image: "/login/slide-4.jpg", art: "path", title: "연습할수록 단단해지는 응대 역량", desc: "같은 상황도 다시 도전하며 점수와 말 습관의 변화를 확인해요. 어제보다 나아진 내 응대를 만나 보세요." },
];
const INTERVAL_MS = 5500;

export function LoginShowcase({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, reduced]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="인허브 리허설 소개"
      className={clsx("relative min-h-screen overflow-hidden bg-slate-900", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, i) => {
        const showPhoto = !failed[i];
        return (
          <div
            key={s.image}
            aria-hidden={i !== idx}
            className={clsx(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-in-out motion-reduce:transition-none",
              i === idx ? "opacity-100" : "opacity-0",
            )}
          >
            {/* 배경: 사진 → 없으면 브랜드 색 배경 + 서비스 화면 그림 */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1c47a3] via-[#2f6fed] to-[#5b8ff5]" />
            {showPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setFailed((f) => ({ ...f, [i]: true }))}
              />
            )}
            {showPhoto ? (
              // 사진 위에 브랜드 색을 얇게 덮어 장면마다 색감을 맞춤
              <div className="absolute inset-0 bg-gradient-to-br from-[#2f6fed]/25 via-transparent to-slate-950/45" />
            ) : (
              <div className="absolute inset-x-0 top-[14%] flex justify-center px-12">
                <ArtFor art={s.art} />
              </div>
            )}
            {/* 문구: 반투명 유리 카드(글래스모피즘) */}
            <div className="absolute inset-x-10 bottom-24 max-w-xl rounded-3xl border border-white/30 bg-white/15 p-7 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
              <p className="text-[28px] font-extrabold leading-snug tracking-tight [text-shadow:0_1px_12px_rgba(15,23,42,0.35)]">{s.title}</p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-white/90">{s.desc}</p>
            </div>
          </div>
        );
      })}

      <div className="absolute left-10 top-10 flex items-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-3 py-2 text-white backdrop-blur-xl">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-extrabold backdrop-blur">IN</span>
        <span className="text-lg font-extrabold">인허브 리허설</span>
      </div>

      <div className="absolute bottom-10 left-10 flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`${i + 1}번째 소개 보기: ${s.title}`}
            aria-current={i === idx ? "true" : undefined}
            className={clsx("h-2.5 rounded-full transition-all", i === idx ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80")}
          />
        ))}
      </div>
    </section>
  );
}

/* ───── 사진이 없을 때 보여 줄 서비스 화면 그림 ───── */
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md rounded-2xl bg-white/95 p-5 text-slate-800 shadow-2xl shadow-slate-900/30">{children}</div>;
}

function ArtFor({ art }: { art: Art }) {
  if (art === "chat")
    return (
      <Panel>
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700">고객 · 김민지</span>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">감정: 약간 불만 → 보통</span>
        </div>
        <div className="space-y-2 text-sm">
          <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2">아니 요금이 왜 두 번이나 나간 거예요?</p>
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-white">
            많이 놀라셨겠어요. 바로 확인해 드릴게요. 본인 확인을 위해 생년월일을 말씀해 주시겠어요?
          </p>
          <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2">네, 90년 3월 2일이요.</p>
        </div>
      </Panel>
    );
  if (art === "voice")
    return (
      <Panel>
        <div className="flex flex-col items-center gap-4 py-2">
          <span className="text-xs font-semibold text-emerald-700">● 통화 중 · 03:12</span>
          <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
            {[28, 46, 62, 38, 54, 70, 44, 30, 52, 64, 36, 24].map((h, i) => (
              <span key={i} className="w-2 rounded-full bg-brand-500/80" style={{ height: `${h}px` }} />
            ))}
          </div>
          <p className="text-sm text-slate-600">&ldquo;네, 고객님. 지금 바로 조회해 드릴게요.&rdquo;</p>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full border border-slate-200 px-3 py-1">음소거</span>
            <span className="rounded-full border border-slate-200 px-3 py-1">↪ 연결·이관</span>
            <span className="rounded-full bg-rose-500 px-3 py-1 text-white">■ 종료</span>
          </div>
        </div>
      </Panel>
    );
  if (art === "report")
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-xl font-extrabold text-brand-700">A</span>
          <div>
            <p className="text-sm font-semibold">요금 이중 청구 컴플레인</p>
            <p className="text-xs text-slate-500">총점 85점</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs">
          {[
            ["공감·경청", 92],
            ["문제 해결", 80],
            ["정확한 안내", 70],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-center gap-2">
              <span className="w-20 text-slate-600">{k}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${v}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">빠뜨린 안내 1건 · 환불 예정일을 함께 알려 주세요</p>
      </Panel>
    );
  return (
    <Panel>
      <p className="mb-3 text-xs font-semibold text-brand-600">교육 과정 · 고객센터 신입 과정</p>
      <ol className="space-y-2.5 text-sm">
        {[
          ["완료", "요금 이중 청구 컴플레인"],
          ["지금", "해지 요청 방어"],
          ["잠김", "서류 절차 문의"],
        ].map(([st, t], i) => (
          <li key={t} className="flex items-center gap-3">
            <span
              className={clsx(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                st === "완료" ? "bg-emerald-500 text-white" : st === "지금" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-400",
              )}
            >
              {st === "완료" ? "✓" : i + 1}
            </span>
            <span className={st === "잠김" ? "text-slate-400" : ""}>{t}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">개인 연습 · 남은 이용권 3회</p>
    </Panel>
  );
}
