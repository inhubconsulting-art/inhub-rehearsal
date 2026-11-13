/**
 * ===== 쉬운 설명 =====
 * 무엇: 화면을 불러오는 동안 잠깐 보여 주는 '불러오는 중' 표시입니다. (빈 화면으로 멈춘 것처럼 보이지 않게)
 * =====================
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="불러오는 중">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
    </div>
  );
}
