/**
 * ===== 쉬운 설명 =====
 * 무엇: '이용권' 화면. 남은 횟수, 받은·쓴 횟수, 사용 내역, 이용권 종류(결제 준비 중)를 보여 줍니다.
 * 언제: 왼쪽 메뉴 '이용권', 연습하기의 '이용권' 버튼.
 * 리뷰 포인트:
 *  - 개인 연습 1번 = 1회 차감. 교육 과정(입장 코드) 실습은 차감되지 않습니다.
 *  - 지금은 운영자가 지급합니다(가입하면 체험 3회 자동). 결제는 아직 열지 않았고 가격 칸은 [가격]으로 비워 둡니다.
 * =====================
 */
import { requirePageUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { getPassBalance, getPassLedger, PASS_REASON_LABELS } from "@/lib/practice";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";

const PLANS = [
  { name: "10회권", desc: "가볍게 시작하기", price: "[가격]", feats: ["개인 연습 10회", "리포트·대화 분석 포함"] },
  { name: "30회권", desc: "자격증·면접 준비", price: "[가격]", feats: ["개인 연습 30회", "모의고사 응시 포함 (출시 후)"], recommended: true },
  { name: "월 정기권", desc: "매달 자동 충전", price: "[월 가격]", feats: ["매달 정해진 횟수 충전", "언제든 해지"] },
];

export default async function PassPage() {
  const u = await requirePageUser();
  const [balance, ledger] = await Promise.all([getPassBalance(u.id), getPassLedger(u.id)]);
  const received = ledger.filter((l) => l.delta > 0 && l.reason !== "refund").reduce((a, l) => a + l.delta, 0);
  const used = ledger.filter((l) => l.reason === "practice").length;

  return (
    <AppShell user={u}>
      <PageHeader title="이용권" description="개인 연습에 쓰는 이용권이에요. 교육 과정(입장 코드)으로 하는 실습은 차감되지 않아요." />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-56 flex-1">
            <p className="text-sm text-slate-500">남은 이용권</p>
            <p className="mt-1">
              <span className="text-5xl font-extrabold tabular-nums">{balance ?? "-"}</span>
              <span className="ml-1 text-slate-500">회</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">개인 연습 1번 = 1회 · 중간에 끝내도 1회 차감</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">받은 횟수</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{received}회</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">사용</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{used}회</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">교육 과정 실습</p>
              <p className="mt-0.5 text-xl font-bold">차감 없음</p>
            </div>
          </div>
          <LinkButton href="/practice">연습하러 가기</LinkButton>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-bold">이용권 종류</h2>
      <div className="mb-2 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`flex flex-col gap-2 rounded-xl bg-white p-5 ${p.recommended ? "border-2 border-brand-500" : "border border-slate-200"}`}>
            {p.recommended && (
              <div>
                <Badge tone="blue">추천</Badge>
              </div>
            )}
            <h3 className="text-lg font-extrabold">{p.name}</h3>
            <p className="text-sm text-slate-500">{p.desc}</p>
            <p className="text-xl font-extrabold">{p.price}</p>
            <ul className="space-y-1 text-sm text-slate-600">
              {p.feats.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button type="button" disabled className="mt-auto min-h-11 rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500">
              결제 준비 중
            </button>
          </div>
        ))}
      </div>
      <p className="mb-6 text-sm text-slate-500">지금은 운영자가 이용권을 지급해요. 결제가 열리면 여기서 바로 구매할 수 있어요.</p>

      <Card>
        <CardTitle>사용 내역</CardTitle>
        {ledger.length === 0 ? (
          <EmptyState title="아직 내역이 없어요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">날짜</th>
                  <th className="py-2 pr-3 font-medium">내용</th>
                  <th className="py-2 text-right font-medium">변동</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">{fmtDateTime(l.created_at)}</td>
                    <td className="py-2.5 pr-3">
                      {PASS_REASON_LABELS[l.reason]}
                      {l.note && <span className="text-slate-500"> · {l.note}</span>}
                    </td>
                    <td className={`whitespace-nowrap py-2.5 text-right font-semibold tabular-nums ${l.delta > 0 ? "text-emerald-700" : ""}`}>
                      {l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}회
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
