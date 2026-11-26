/**
 * ===== 쉬운 설명 =====
 * 무엇: 테스트할 시나리오와 표현 목록(쿠션어·금지어 등)을 읽어 옵니다.
 *   - db  : 운영 Supabase 에서 '공개' 시나리오의 현재 버전과 켜진 표현 목록을 읽기만 합니다(쓰기 없음).
 *   - seed: 인터넷 없이 supabase/seed.sql 의 기본 시나리오 4개와 마이그레이션의 기본 표현 목록을 씁니다.
 * 언제: 시뮬레이션 시작 시 한 번.
 * 리뷰 포인트: 운영 DB 를 '읽기'만 하는지 확인하세요(GET 요청만 사용).
 * =====================
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEXICON_CATEGORIES, ScenarioContentSchema, type Lexicon } from "../../packages/shared/src/index.ts";
import type { SimScenario } from "./types.ts";

async function rest<T>(url: string, key: string, path: string): Promise<T> {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export async function loadFromDb(url: string, key: string, includeDrafts: boolean): Promise<{ scenarios: SimScenario[]; lexicon: Lexicon }> {
  const rows = await rest<{ id: string; title: string; status: string; current_version: number }[]>(
    url,
    key,
    `scenarios?select=id,title,status,current_version${includeDrafts ? "&status=neq.archived" : "&status=eq.published"}&order=created_at.asc`,
  );
  const scenarios: SimScenario[] = [];
  if (rows.length) {
    const ids = rows.map((r) => r.id).join(",");
    const versions = await rest<{ scenario_id: string; version: number; content: unknown }[]>(
      url,
      key,
      `scenario_versions?select=scenario_id,version,content&scenario_id=in.(${ids})`,
    );
    for (const r of rows) {
      const v = versions.find((x) => x.scenario_id === r.id && x.version === r.current_version);
      if (!v) continue;
      const parsed = ScenarioContentSchema.safeParse(v.content);
      if (!parsed.success) {
        console.warn(`  ! 시나리오 '${r.title}' 형식 오류로 건너뜀: ${parsed.error.issues[0]?.message}`);
        continue;
      }
      scenarios.push({ id: r.id, version: v.version, content: parsed.data, source: "db" });
    }
  }
  const lexRows = await rest<{ category: string; phrase: string }[]>(url, key, "phrase_lexicon?select=category,phrase&active=eq.true");
  const lexicon = emptyLexicon();
  for (const r of lexRows) (lexicon as Record<string, string[]>)[r.category]?.push(r.phrase);
  return { scenarios, lexicon };
}

export function loadFromSeed(repoRoot: string): { scenarios: SimScenario[]; lexicon: Lexicon } {
  const sql = readFileSync(join(repoRoot, "supabase", "seed.sql"), "utf8");
  const scenarios: SimScenario[] = [];
  const re = /\('([0-9a-f-]{36})',\s*(\d+),\s*\$json\$([\s\S]*?)\$json\$/g;
  for (const m of sql.matchAll(re)) {
    const parsed = ScenarioContentSchema.safeParse(JSON.parse(m[3]));
    if (!parsed.success) {
      console.warn(`  ! seed 시나리오 ${m[1]} 형식 오류: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    scenarios.push({ id: m[1], version: Number(m[2]), content: parsed.data, source: "seed" });
  }
  const mig = readFileSync(join(repoRoot, "supabase", "migrations", "20261118000000_learning_analytics.sql"), "utf8");
  const lexicon = emptyLexicon();
  for (const m of mig.matchAll(/\('(cushion|apology|empathy|forbidden|filler)',\s*'([^']+)'\)/g)) lexicon[m[1] as keyof Lexicon].push(m[2]);
  return { scenarios, lexicon };
}

function emptyLexicon(): Lexicon {
  return Object.fromEntries(LEXICON_CATEGORIES.map((c) => [c, [] as string[]])) as Lexicon;
}

/** --scenarios 로 고르기: id 앞부분 또는 제목 일부 */
export function filterScenarios(list: SimScenario[], query: string[] | null): SimScenario[] {
  if (!query?.length) return list;
  return list.filter((s) => query.some((q) => s.id.startsWith(q) || s.content.title.includes(q)));
}
