/**
 * ===== 쉬운 설명 =====
 * 무엇: OpenAI에서 '실제 청구액'을 직접 불러옵니다 (OpenAI Costs API).
 * 언제: 관리자 '사용량·비용' 화면을 열 때.
 * 준비물: 환경변수 OPENAI_ADMIN_KEY (조직 소유자가 platform.openai.com → Admin keys 에서 발급한 관리자 키).
 *        OPENAI_PROJECT_ID 를 넣으면 그 프로젝트의 비용만 셉니다(조직에 다른 서비스도 있을 때).
 * 횟수 제한: OpenAI는 이 조회를 1분에 30번까지만 허용합니다. 그래서
 *  - 지난 달 1일 ~ 오늘을 '한 번에' 불러와 이번 달/지난 달로 나누고,
 *  - 결과를 10분 동안 저장해 두었다가 재사용합니다(화면을 여러 번 새로고침해도 다시 묻지 않음).
 *  - 한도에 걸리면 마지막으로 성공한 결과를 보여 줍니다.
 * 리뷰 포인트:
 *  - OpenAI는 '교육 차수'를 모르기 때문에 여기서는 기간 전체 금액만 가져옵니다. 차수별 금액은 앱 기록으로 계산합니다.
 *  - OpenAI 비용은 하루(UTC 기준) 단위로 집계되고, 반영까지 시간이 걸릴 수 있습니다.
 * =====================
 */
import { unstable_cache } from "next/cache";

export type ActualCosts =
  | { ok: true; total: number; byLineItem: { name: string; value: number }[] }
  | { ok: false; reason: "no_key" | "rate_limited" | "error"; message?: string };

/** 하루치 비용: 날짜(UTC 자정, 초 단위)와 항목별 금액 */
type DayCost = { start: number; items: Record<string, number> };

type CostsPage = {
  data: { start_time: number; results: { amount?: { value?: number }; line_item?: string | null }[] }[];
  has_more?: boolean;
  next_page?: string | null;
};

class RateLimited extends Error {}

/** OpenAI에 실제로 묻는 부분. 실패하면 오류를 던져서 '실패 결과'가 저장되지 않게 합니다. */
async function fetchDays(startSec: number, endSec: number): Promise<DayCost[]> {
  const key = process.env.OPENAI_ADMIN_KEY!;
  const days: DayCost[] = [];
  let page: string | null | undefined;
  for (let i = 0; i < 3; i++) {
    const q = new URLSearchParams({
      start_time: String(startSec),
      end_time: String(endSec),
      bucket_width: "1d",
      limit: "180",
    });
    q.append("group_by", "line_item");
    if (process.env.OPENAI_PROJECT_ID) q.append("project_ids", process.env.OPENAI_PROJECT_ID);
    if (page) q.set("page", page);

    const res = await fetch(`https://api.openai.com/v1/organization/costs?${q}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 429) throw new RateLimited("rate limited");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as CostsPage;
    for (const bucket of json.data ?? []) {
      const items: Record<string, number> = {};
      for (const r of bucket.results ?? []) {
        const v = Number(r.amount?.value ?? 0);
        if (!Number.isFinite(v)) continue;
        const name = r.line_item ?? "기타";
        items[name] = (items[name] ?? 0) + v;
      }
      days.push({ start: bucket.start_time, items });
    }
    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }
  return days;
}

/** 10분 동안 결과를 저장해 두는 버전 (Vercel의 여러 서버가 함께 씀). 실패는 저장하지 않습니다. */
const cachedDays = unstable_cache(fetchDays, ["openai-costs-v1"], { revalidate: 600 });

/** 한도에 걸렸을 때 보여 줄 '마지막 성공 결과' (서버 하나 안에서만 유지) */
let lastGood: { key: string; days: DayCost[] } | null = null;

function summarize(days: DayCost[], from: Date, to: Date): ActualCosts {
  const a = from.getTime() / 1000;
  const b = to.getTime() / 1000;
  const byItem = new Map<string, number>();
  let total = 0;
  for (const d of days) {
    if (d.start < a || d.start >= b) continue;
    for (const [name, v] of Object.entries(d.items)) {
      total += v;
      byItem.set(name, (byItem.get(name) ?? 0) + v);
    }
  }
  const byLineItem = [...byItem.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0.0049)
    .sort((x, y) => y.value - x.value);
  return { ok: true, total, byLineItem };
}

/**
 * 여러 기간의 실제 비용을 '한 번의 조회'로 구합니다.
 * 날짜는 UTC 자정 기준으로 잘라서 넘겨 주세요. 결과는 ranges 와 같은 순서입니다.
 */
export async function fetchActualCostsFor(ranges: { from: Date; to: Date }[]): Promise<ActualCosts[]> {
  if (!process.env.OPENAI_ADMIN_KEY) return ranges.map((): ActualCosts => ({ ok: false, reason: "no_key" }));

  const startSec = Math.floor(Math.min(...ranges.map((r) => r.from.getTime())) / 1000);
  const endSec = Math.floor(Math.max(...ranges.map((r) => r.to.getTime())) / 1000);
  const cacheKey = `${startSec}-${endSec}-${process.env.OPENAI_PROJECT_ID ?? ""}`;

  let days: DayCost[];
  try {
    days = await cachedDays(startSec, endSec);
    lastGood = { key: cacheKey, days };
  } catch (e) {
    if (lastGood?.key === cacheKey) {
      days = lastGood.days;
    } else {
      const fail: ActualCosts =
        e instanceof RateLimited
          ? { ok: false, reason: "rate_limited" }
          : { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
      return ranges.map(() => fail);
    }
  }
  return ranges.map((r) => summarize(days, r.from, r.to));
}
