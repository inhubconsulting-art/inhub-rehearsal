"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 표현 목록 관리 화면의 본체. 분류(쿠션어·사과·공감·금지 표현·말버릇)마다 표현을 칩으로 보여 줍니다.
 *      칩을 누르면 켜기/끄기, ×는 삭제, 아래 입력칸으로 추가. 맨 위 '문장 넣어 보기'로 지금 목록이 무엇을 찾는지 바로 확인합니다.
 * 언제: 관리자 → 표현 목록.
 * 리뷰 포인트: 꺼진 표현은 흐리게 보이고 분석에서 빠집니다(기록은 남음). 칩의 숫자는 최근 실습에서 나온 횟수입니다.
 *         '문장 넣어 보기'는 실제 분석과 같은 규칙(긴 표현 우선, 말버릇은 쉼표·반복일 때만 등)으로 계산합니다.
 * =====================
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { analyzeConversation, LEXICON_CATEGORIES, type Lexicon, type LexiconCategory } from "@inhub/shared";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";

export interface LexiconItem {
  id: string;
  category: LexiconCategory;
  phrase: string;
  active: boolean;
  created_at: string;
  uses: number;
}

const META: Record<LexiconCategory, { label: string; desc: string; tone: string; example: string }> = {
  cushion: { label: "쿠션어", desc: "부탁·거절·질문 앞에 붙여 말을 부드럽게 하는 표현", tone: "bg-sky-50 text-sky-800 border-sky-200", example: "예: 번거로우시겠지만" },
  empathy: { label: "공감 표현", desc: "고객의 감정을 알아주는 표현", tone: "bg-emerald-50 text-emerald-800 border-emerald-200", example: "예: 많이 놀라셨겠" },
  apology: { label: "사과", desc: "불편에 대해 사과하는 표현", tone: "bg-violet-50 text-violet-800 border-violet-200", example: "예: 불편을 드려" },
  filler: { label: "말버릇(필러)", desc: "말 앞뒤에 버릇처럼 붙는 말. 뒤에 쉼표·말줄임표가 오거나 혼자 있을 때만 셉니다", tone: "bg-amber-50 text-amber-800 border-amber-200", example: "예: 그러니까" },
  forbidden: { label: "금지 표현", desc: "고객을 막거나 책임을 돌리는 말", tone: "bg-rose-50 text-rose-800 border-rose-200", example: "예: 규정상" },
};
const ORDER: LexiconCategory[] = ["cushion", "empathy", "apology", "filler", "forbidden"];

export function LexiconManager({ items, sampled }: { items: LexiconItem[]; sampled: number }) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<LexiconCategory, string>>({ cushion: "", apology: "", empathy: "", forbidden: "", filler: "" });
  const [sample, setSample] = useState("음, 고객님 많이 놀라셨겠어요. 번거로우시겠지만 생년월일 확인 부탁드립니다. 규정상 바로 환불은 어렵습니다.");

  const lexicon = useMemo(() => {
    const lex = Object.fromEntries(LEXICON_CATEGORIES.map((c) => [c, [] as string[]])) as Lexicon;
    for (const it of items) if (it.active) lex[it.category].push(it.phrase);
    return lex;
  }, [items]);

  // 쉬운 설명: 입력한 문장을 실제 분석과 같은 함수로 돌려 무엇이 잡히는지 보여 줌
  const found = useMemo(() => {
    if (!sample.trim()) return null;
    const now = new Date().toISOString();
    const { utterances } = analyzeConversation({
      messages: [{ id: "sample", seq: 1, role: "learner", content: sample, created_at: now }],
      mode: "text",
      startedAt: now,
      endedAt: now,
      lexicon,
    });
    const u = utterances[0];
    if (!u) return null;
    return { cushion: u.cushions, apology: u.apologies, empathy: u.empathies, forbidden: u.forbidden, filler: u.fillers } as Record<LexiconCategory, string[]>;
  }, [sample, lexicon]);

  async function call(url: string, init: RequestInit, ok: string) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { error?: string; reactivated?: boolean }) : {};
    if (!res?.ok) {
      showToast(json.error ?? "처리하지 못했습니다.", "error");
      return false;
    }
    showToast(json.reactivated ? "꺼져 있던 표현을 다시 켰어요" : ok);
    router.refresh();
    return true;
  }

  async function add(c: LexiconCategory) {
    const phrase = drafts[c].trim();
    if (!phrase) return;
    setBusyId(`add:${c}`);
    const ok = await call("/api/lexicon", { method: "POST", body: JSON.stringify({ category: c, phrase }) }, `'${phrase}'을(를) 추가했어요`);
    setBusyId(null);
    if (ok) setDrafts((d) => ({ ...d, [c]: "" }));
  }
  async function toggle(it: LexiconItem) {
    setBusyId(it.id);
    await call(`/api/lexicon/${it.id}`, { method: "PATCH", body: JSON.stringify({ active: !it.active }) }, it.active ? `'${it.phrase}'을(를) 껐어요` : `'${it.phrase}'을(를) 켰어요`);
    setBusyId(null);
  }
  async function remove(it: LexiconItem) {
    if (!window.confirm(`'${it.phrase}'을(를) 목록에서 지울까요?\n분석에서만 빼려면 지우지 말고 칩을 눌러 '끄기'를 하세요.`)) return;
    setBusyId(it.id);
    await call(`/api/lexicon/${it.id}`, { method: "DELETE" }, `'${it.phrase}'을(를) 지웠어요`);
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <Card>
        <label htmlFor="lex-sample" className="text-sm font-semibold">
          문장 넣어 보기
        </label>
        <p className="mt-0.5 text-xs text-slate-500">수강생이 했을 법한 말을 적으면, 지금 목록(켜진 표현)으로 무엇이 잡히는지 바로 보여 줘요.</p>
        <textarea
          id="lex-sample"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {ORDER.map((c) => (
            <span key={c}>
              <span className="text-slate-500">{META[c].label}</span>{" "}
              {found && found[c].length ? (
                <b className="text-slate-900">{[...new Set(found[c])].map((p) => `${p}${found[c].filter((x) => x === p).length > 1 ? `×${found[c].filter((x) => x === p).length}` : ""}`).join(", ")}</b>
              ) : (
                <span className="text-slate-400">없음</span>
              )}
            </span>
          ))}
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        칩을 누르면 켜기/끄기, ×는 삭제예요. 칩 옆 숫자는 최근 실습 {sampled}개에서 나온 횟수예요 (너무 많이 잡히면 잘못 잡히는 표현일 수 있어요).
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {ORDER.map((c) => {
          const list = items.filter((i) => i.category === c);
          const on = list.filter((i) => i.active).length;
          return (
            <Card key={c}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">{META[c].label}</h2>
                <span className="text-xs text-slate-500">
                  켜짐 {on} / 전체 {list.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{META[c].desc}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {list.map((it) => (
                  <li
                    key={it.id}
                    className={clsx(
                      "inline-flex items-center overflow-hidden rounded-full border text-sm",
                      it.active ? META[c].tone : "border-dashed border-slate-300 bg-white text-slate-400 line-through",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(it)}
                      disabled={busyId === it.id}
                      title={it.active ? "눌러서 끄기 (분석에서 빼기)" : "눌러서 다시 켜기"}
                      className="py-1 pl-3 pr-1.5 disabled:opacity-50"
                    >
                      {it.phrase}
                      {it.uses > 0 && <span className="ml-1 text-xs tabular-nums opacity-70">{it.uses}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(it)}
                      disabled={busyId === it.id}
                      aria-label={`${it.phrase} 삭제`}
                      className="px-2 py-1 opacity-60 hover:opacity-100 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {list.length === 0 && <li className="text-sm text-slate-400">아직 표현이 없어요.</li>}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add(c);
                }}
              >
                <input
                  value={drafts[c]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c]: e.target.value }))}
                  placeholder={META[c].example}
                  aria-label={`${META[c].label}에 추가할 표현`}
                  maxLength={30}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={!drafts[c].trim() || busyId === `add:${c}`}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  추가
                </button>
              </form>
            </Card>
          );
        })}
      </div>
      {toast}
    </div>
  );
}
