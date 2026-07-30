"use client";

import { useActionState } from "react";
import { claimCodeAction, type AuthState } from "@/app/(auth)/actions";

const initialState: AuthState = { error: null };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(claimCodeAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">수강생 코드</span>
        <input
          name="code"
          required
          autoFocus
          autoComplete="off"
          placeholder="예: HS-2026-A1B2"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-wide outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "확인 중…" : "시작하기"}
      </button>
    </form>
  );
}
