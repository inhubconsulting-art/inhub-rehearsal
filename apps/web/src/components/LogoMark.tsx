/**
 * ===== 쉬운 설명 =====
 * 무엇: 회사 로고 마크(두 사람이 손잡은 모양 + A). public/brand/mark.png 를 '모양 틀'로 써서 원하는 색으로 칠합니다.
 *      글자색(text-…)을 따라가므로 className 에 text-white, text-brand-600 처럼 색을 주면 그 색이 됩니다.
 * 언제: 왼쪽 메뉴 맨 위, 로그인 화면, 프로필 완성 화면 등 로고가 들어가는 자리.
 * 리뷰 포인트: 로고 파일을 바꾸면 public/brand/mark.png(흰색·투명 배경)와 src/app/icon.png(브라우저 탭 아이콘)를 함께 바꾸세요.
 * =====================
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="인허브 로고"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        WebkitMaskImage: "url(/brand/mark.png)",
        maskImage: "url(/brand/mark.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
