/**
 * ===== 쉬운 설명 =====
 * 무엇: 개인정보처리방침·이용약관 화면의 공통 틀 (제목, 시행일, 문서 간 이동 링크, 운영자 정보).
 * 언제: /privacy, /terms 화면에서. 로그인하지 않은 사람도 볼 수 있습니다.
 * 리뷰 포인트: 건너뛰어도 됩니다. 문서 내용은 각 page.tsx, 회사 정보는 lib/legal.ts 에서 고칩니다.
 * =====================
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { fmtDate } from "@/lib/format";
import { EFFECTIVE_DATE, OPERATOR, PREVIOUS_VERSIONS } from "@/lib/legal";

export function LegalPage({ title, current, children }: { title: string; current: "privacy" | "terms"; children: ReactNode }) {
  const biz = [
    OPERATOR.ceo && `대표자 ${OPERATOR.ceo}`,
    OPERATOR.businessNumber && `사업자등록번호 ${OPERATOR.businessNumber}`,
    OPERATOR.address,
  ].filter(Boolean);
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4 text-sm">
          <Link href="/" className="font-bold text-brand-600">
            인허브 리허설
          </Link>
          <nav className="ml-auto flex gap-1">
            <Link href="/terms" className={`rounded-md px-2 py-1 ${current === "terms" ? "bg-slate-100 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
              이용약관
            </Link>
            <Link href="/privacy" className={`rounded-md px-2 py-1 ${current === "privacy" ? "bg-slate-100 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
              개인정보처리방침
            </Link>
          </nav>
        </div>
      </header>
      <main className="legal mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">시행일: {fmtDate(EFFECTIVE_DATE)}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-7 text-slate-700">{children}</div>
        {PREVIOUS_VERSIONS.length > 0 && (
          <p className="mt-10 text-xs text-slate-400">이전 시행일: {PREVIOUS_VERSIONS.map((d) => fmtDate(d)).join(", ")}</p>
        )}
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>{OPERATOR.name}</p>
        {biz.length > 0 && <p className="mt-1">{biz.join(" · ")}</p>}
        <p className="mt-1">문의 {OPERATOR.contactEmail}</p>
      </footer>
    </div>
  );
}

/** 문서 안의 조항 하나 (제목 + 내용) */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** 번호 없는 목록 */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** 간단한 표 */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-slate-200 px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
