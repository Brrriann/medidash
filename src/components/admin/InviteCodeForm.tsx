"use client";

import { useActionState } from "react";
import {
  createInviteCode,
  type AdminActionState,
} from "@/app/(dashboard)/admin/actions";

const initialState: AdminActionState = { ok: false, error: null };

/** 수강생 코드 발급 폼 — 코드는 서버에서 자동 생성(MEDI-XXXX-XXXX) */
export function InviteCodeForm({ mock }: { mock: boolean }) {
  const [state, action, pending] = useActionState(createInviteCode, initialState);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            메모 (기수·용도)
          </span>
          <input
            type="text"
            name="memo"
            placeholder="예: 8월 기수"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            사용 가능 횟수
          </span>
          <input
            type="number"
            name="maxUses"
            defaultValue={1}
            min={1}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          만료일 (선택)
        </span>
        <input
          type="date"
          name="expiresAt"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <button
        type="submit"
        disabled={mock || pending}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "발급 중…" : "코드 발급"}
      </button>

      {mock && (
        <p className="text-center text-xs text-slate-600">
          Mock 모드 — Supabase 연결 후 발급이 활성화됩니다
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && state.createdCode && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
          발급 완료: <code className="select-all">{state.createdCode}</code>
        </p>
      )}
    </form>
  );
}
