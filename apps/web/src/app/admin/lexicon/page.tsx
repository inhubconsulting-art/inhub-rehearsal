/**
 * ===== 쉬운 설명 =====
 * 무엇: 대화 분석에 쓰는 표현 목록(쿠션어·사과·공감·금지 표현·말버릇) 관리 화면.
 *      표현마다 최근 실습에서 몇 번 나왔는지 함께 보여 주고, 추가·켜기/끄기·삭제와 '문장 넣어 보기'를 할 수 있습니다.
 * 언제: 관리자 메뉴 '표현 목록'.
 * 리뷰 포인트: 목록을 바꾸면 상시 서버가 몇 분 안에 지난 실습까지 새 목록으로 다시 분석합니다(분석 화면 숫자가 바뀜).
 *         사용 횟수는 최근 실습 500개 기준입니다.
 * =====================
 */
import { LEXICON_CATEGORIES, type LexiconCategory } from "@inhub/shared";
import { requirePageUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader } from "@/components/ui";
import { LexiconManager, type LexiconItem } from "@/components/admin/LexiconManager";

export default async function LexiconPage() {
  const u = await requirePageUser(["admin"]);
  const db = adminClient();
  const [{ data, error }, { data: recent }] = await Promise.all([
    db.from("phrase_lexicon").select("id, category, phrase, active, created_at").order("created_at"),
    db.from("session_analytics").select("phrase_counts").order("computed_at", { ascending: false }).limit(500),
  ]);

  // 쉬운 설명: 최근 실습들의 표현별 사용 횟수를 더함 → 너무 자주 잡히는(잘못 잡히는) 표현이나 아무도 안 쓰는 표현을 찾기 쉬움
  const uses = new Map<string, number>();
  for (const r of (recent ?? []) as { phrase_counts: Partial<Record<LexiconCategory, Record<string, number>>> | null }[]) {
    for (const c of LEXICON_CATEGORIES) {
      for (const [p, n] of Object.entries(r.phrase_counts?.[c] ?? {})) uses.set(`${c}:${p}`, (uses.get(`${c}:${p}`) ?? 0) + Number(n || 0));
    }
  }
  const items: LexiconItem[] = ((data ?? []) as Omit<LexiconItem, "uses">[]).map((r) => ({
    ...r,
    uses: uses.get(`${r.category}:${r.phrase}`) ?? 0,
  }));

  return (
    <AppShell user={u} wide>
      <PageHeader
        title="표현 목록"
        description="대화 분석이 찾아내는 표현들이에요. 추가·끄기·삭제하면 몇 분 안에 지난 실습까지 새 기준으로 다시 분석됩니다."
      />
      {error ? (
        <EmptyState title="표현 목록 표가 아직 없어요.">Supabase SQL Editor에서 학습 데이터 수집 SQL(20261118000000)을 먼저 실행해 주세요.</EmptyState>
      ) : (
        <LexiconManager items={items} sampled={(recent ?? []).length} />
      )}
    </AppShell>
  );
}
