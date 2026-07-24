"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthState } from "@/app/(auth)/actions";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">로그인</h1>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">이메일</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="seller@example.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">비밀번호</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
        {pending ? "로그인 중…" : "로그인"}
      </button>

      <p className="text-center text-xs text-slate-500">
        아직 계정이 없나요?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand-600 underline-offset-2 hover:underline"
        >
          수강생 코드로 가입
        </Link>
      </p>
    </form>
  );
}
