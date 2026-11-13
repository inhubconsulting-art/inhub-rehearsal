/**
 * ===== 쉬운 설명 =====
 * 무엇: OpenAI에서 '실제 청구액'을 직접 불러옵니다 (OpenAI Costs API).
 * 언제: 관리자 '사용량·비용' 화면을 열 때. 10분 동안은 같은 결과를 재사용합니다.
 * 준비물: 환경변수 OPENAI_ADMIN_KEY (조직 소유자가 platform.openai.com → Admin keys 에서 발급한 관리자 키).
 *        OPENAI_PROJECT_ID 를 넣으면 그 프로젝트의 비용만 셉니다(조직에 다른 서비스도 있을 때).
 * 리뷰 포인트:
 *  - OpenAI는 '교육 차수'를 모르기 때문에 여기서는 기간 전체 금액만 가져옵니다. 차수별 금액은 앱 기록으로 계산합니다.
 *  - OpenAI 비용은 하루(UTC 기준) 단위로 집계되고, 반영까지 시간이 걸릴 수 있습니다.
 * =====================
 */

export type ActualCosts =
  | { ok: true; total: number; byLineItem: { name: string; value: number }[] }
  | { ok: false; reason: "no_key" | "error"; message?: string };

type CostsPage = {
  data: {
    results: { amount?: { value?: number }; line_item?: string | null }[];
  }[];
  has_more?: boolean;
  next_page?: string | null;
};

export function adminKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_ADMIN_KEY);
}

/** start 이상 end 미만 기간의 실제 비용(USD). 날짜는 UTC 자정 기준으로 잘라서 넘겨 주세요. */
export async function fetchActualCosts(start: Date, end: Date): Promise<ActualCosts> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return { ok: false, reason: "no_key" };

  const byItem = new Map<string, number>();
  let total = 0;
  let page: string | null | undefined = undefined;

  try {
    // 결과가 여러 쪽으로 나뉘어 오면 끝까지 넘겨 가며 모두 더합니다 (최대 10쪽).
    for (let i = 0; i < 10; i++) {
      const q = new URLSearchParams({
        start_time: String(Math.floor(start.getTime() / 1000)),
        end_time: String(Math.floor(end.getTime() / 1000)),
        bucket_width: "1d",
        limit: "180",
      });
      q.append("group_by", "line_item");
      if (process.env.OPENAI_PROJECT_ID) q.append("project_ids", process.env.OPENAI_PROJECT_ID);
      if (page) q.set("page", page);

      const res = await fetch(`https://api.openai.com/v1/organization/costs?${q}`, {
        headers: { Authorization: `Bearer ${key}` },
        next: { revalidate: 600 },
      } as RequestInit);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, reason: "error", message: `${res.status} ${body.slice(0, 200)}` };
      }
      const json = (await res.json()) as CostsPage;
      for (const bucket of json.data ?? []) {
        for (const r of bucket.results ?? []) {
          const v = Number(r.amount?.value ?? 0);
          if (!Number.isFinite(v)) continue;
          total += v;
          const name = r.line_item ?? "기타";
          byItem.set(name, (byItem.get(name) ?? 0) + v);
        }
      }
      if (!json.has_more || !json.next_page) break;
      page = json.next_page;
    }
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }

  const byLineItem = [...byItem.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0.0049)
    .sort((a, b) => b.value - a.value);
  return { ok: true, total, byLineItem };
}
