"use client";
/**
 * ===== 쉬운 설명 =====
 * 무엇: 사용자 역할 선택 상자.
 * 언제: 사용자 화면.
 * 리뷰 포인트: 건너뛰어도 됩니다.
 * =====================
 */
import { useState } from "react";
import type { Role } from "@inhub/shared";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
  const [value, setValue] = useState<Role>(role);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={disabled || state === "saving"}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        onChange={async (e) => {
          const next = e.target.value as Role;
          setValue(next);
          setState("saving");
          const res = await fetch(`/api/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: next }),
          });
          setState(res.ok ? "saved" : "error");
          if (!res.ok) setValue(role);
        }}
      >
        <option value="learner">수강생</option>
        <option value="instructor">강사</option>
        <option value="admin">운영 관리자</option>
      </select>
      {state === "saved" && <span className="text-xs text-emerald-600">저장됨</span>}
      {state === "error" && <span className="text-xs text-rose-600">실패</span>}
    </div>
  );
}
