import type { Metadata } from "next";
import Link from "next/link";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getMarginHistory, getRecentWorks } from "@/lib/data";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "내 계정" };

const WORK_LABELS: Record<string, string> = {
  thumbnail: "썸네일",
  title_tags: "상품명·태그",
  margin: "마진 계산",
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export default async function MyPage() {
  const mock = isMockMode();

  let email: string | null = null;
  let role: string | null = null;
  if (!mock) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = profile?.role ?? null;
    }
  }

  const [works, margins] = await Promise.all([
    getRecentWorks(),
    getMarginHistory(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        overline="My Page"
        title="내 계정"
        description="내 작업 이력과 계정을 관리합니다."
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        {/* 계정 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">계정</h2>
          {mock ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Mock 모드 — Supabase 연결 후 로그인하면 계정 정보가 표시됩니다.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400">이메일</p>
                <p className="text-sm font-semibold text-slate-800">
                  {email ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">역할</p>
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    role === "admin"
                      ? "bg-accent-100 text-accent-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {role ?? "member"}
                </span>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  로그아웃
                </button>
              </form>
            </div>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            결제 내역은 W4(토스페이먼츠 연동)에서 제공됩니다.
          </p>
        </section>

        {/* 작업 이력 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">작업 이력</h2>
          {works.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-400">아직 작업 이력이 없습니다</p>
              <p className="mt-1 text-xs text-slate-400">
                썸네일·상품명 산출물은 W3부터 여기에 쌓입니다
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {works.map((w, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span className="text-slate-700">
                    {WORK_LABELS[w.kind] ?? w.kind}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(w.createdAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 마진 계산 이력 */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">마진 계산 이력</h2>
          <Link
            href="/margin"
            className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            마진 계산 →
          </Link>
        </div>
        {margins.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            저장된 계산이 없습니다
            {mock && " (mock 모드 — Supabase 연결 후 활성화)"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">일시</th>
                  <th className="py-2 pr-4 font-medium">플랫폼</th>
                  <th className="py-2 pr-4 font-medium">판매가</th>
                  <th className="py-2 pr-4 font-medium">최종마진</th>
                  <th className="py-2 font-medium">최종마진율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {margins.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-4 text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 pr-4">{m.platform === "coupang" ? "쿠팡" : m.platform === "naver" ? "네이버" : m.platform}</td>
                    <td className="py-2 pr-4">{won(m.price)}</td>
                    <td
                      className={`py-2 pr-4 font-semibold ${
                        m.finalMargin >= 0 ? "text-brand-700" : "text-red-600"
                      }`}
                    >
                      {won(m.finalMargin)}
                    </td>
                    <td className="py-2">{(m.finalMarginRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
