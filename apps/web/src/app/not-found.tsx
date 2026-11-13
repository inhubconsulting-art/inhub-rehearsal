/**
 * ===== 쉬운 설명 =====
 * 무엇: 없는 주소로 들어왔을 때 보여 주는 안내 화면입니다.
 * =====================
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-slate-500">주소가 바뀌었거나 삭제된 화면입니다.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          처음 화면으로
        </Link>
      </div>
    </div>
  );
}
