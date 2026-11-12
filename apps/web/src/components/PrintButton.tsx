"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 'PDF 저장' 버튼. 브라우저 인쇄 창을 엽니다.
 * 언제: 리포트 화면, 일괄 인쇄 화면.
 * 리뷰 포인트: 인쇄 창에서 '대상: PDF로 저장'을 고르면 PDF가 됩니다.
 * =====================
 */
import { Button } from "@/components/ui";

/** 브라우저 인쇄 → 'PDF로 저장' (PRD R-06) */
export function PrintButton({ label = "PDF 저장" }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
