"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 화면에서 예상하지 못한 오류가 나면 영어 흰 화면 대신 보여 주는 안내 화면입니다.
 * 언제: 어떤 화면이든 오류가 났을 때 자동으로.
 * 리뷰 포인트: '다시 시도'는 같은 화면을 다시 그립니다. 대화 중이었다면 대화가 그대로 이어집니다
 *         (대화 기록은 서버에 저장되어 있음).
 * =====================
 */
import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 원인 확인용으로 브라우저 콘솔에 남깁니다 (F12 → Console).
    console.error("[inhub] 화면 오류:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">!</div>
        <h1 className="text-lg font-semibold">화면을 불러오는 중 문제가 생겼어요</h1>
        <p className="mt-2 text-sm text-slate-500">
          일시적인 문제일 수 있어요. 다시 시도해 주세요. 대화 중이었다면 지금까지의 대화는 저장되어 있습니다.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            다시 시도
          </button>
          <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
            처음 화면으로
          </Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-slate-400">오류 번호: {error.digest}</p>}
      </div>
    </div>
  );
}
