"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthState } from "@/app/(auth)/actions";

const initialState: AuthState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">회원가입</h1>
      <p className="text-xs leading-relaxed text-slate-500">
        가입에는 <strong className="text-slate-700">수강생 코드</strong>가
        필요합니다. 코드가 없다면 운영자에게 문의하세요.
      </p>

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
        <span className="mb-1 block font-medium text-slate-700">
          비밀번호 <span className="font-normal text-slate-600">(8자 이상)</span>
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">수강생 코드</span>
        <input
          type="text"
          name="code"
          required
          placeholder="예: MEDI-2026-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
        {pending ? "가입 중…" : "가입하기"}
      </button>

      <p className="text-center text-xs text-slate-500">
        이미 계정이 있나요?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-600 underline-offset-2 hover:underline"
        >
          로그인
        </Link>
      </p>
    </form>
  );
}
