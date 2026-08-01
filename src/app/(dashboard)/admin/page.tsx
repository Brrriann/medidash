import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getAdminData, getWholesaleProducts } from "@/lib/data";
import { InviteCodeForm } from "@/components/admin/InviteCodeForm";
import { deleteInviteCode } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "관리자" };

export default async function AdminPage() {
  const mock = isMockMode();

  // mock 모드는 화면 구조 확인용으로 통과, 실모드는 admin 역할 필수
  if (!mock) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") redirect("/");
  }

  const [{ codes, members }, { crawledAt, isSample }] = await Promise.all([
    getAdminData(),
    getWholesaleProducts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="관리자"
        description="수강생 코드 발급·회원 관리·데이터 갱신을 수행합니다."
        aside={
          mock ? (
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
              Mock 모드 — 샘플 데이터 표시 중
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        {/* 코드 발급 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">
            수강생 코드 발급
          </h2>
          <InviteCodeForm mock={mock} />
        </section>

        {/* 코드 목록 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">
            발급된 코드 <span className="font-normal text-slate-400">({codes.length})</span>
          </h2>
          {codes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              발급된 코드가 없습니다
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-2 pr-3 font-medium">코드</th>
                    <th className="py-2 pr-3 font-medium">메모</th>
                    <th className="py-2 pr-3 font-medium">사용</th>
                    <th className="py-2 pr-3 font-medium">만료</th>
                    <th className="py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {codes.map((c) => {
                    const expired =
                      c.expiresAt != null && new Date(c.expiresAt) < new Date();
                    const exhausted = c.used >= c.maxUses;
                    return (
                      <tr key={c.code}>
                        <td className="py-2 pr-3 font-mono text-xs font-semibold text-slate-700">
                          {c.code}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">
                          {c.memo ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {c.used}/{c.maxUses}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">
                          {c.expiresAt
                            ? new Date(c.expiresAt).toLocaleDateString("ko-KR")
                            : "없음"}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                expired || exhausted
                                  ? "bg-slate-100 text-slate-400"
                                  : "bg-brand-100 text-brand-700"
                              }`}
                            >
                              {expired ? "만료" : exhausted ? "소진" : "사용 가능"}
                            </span>
                            {!c.isSample && (
                              <form action={deleteInviteCode}>
                                <input type="hidden" name="code" value={c.code} />
                                <button
                                  type="submit"
                                  aria-label={`${c.code} 삭제`}
                                  className="rounded p-0.5 text-slate-300 transition hover:text-red-500"
                                >
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* 회원 목록 */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          회원 목록 <span className="font-normal text-slate-400">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">회원이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">이메일</th>
                  <th className="py-2 pr-4 font-medium">역할</th>
                  <th className="py-2 pr-4 font-medium">가입 코드</th>
                  <th className="py-2 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4">{m.email ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.role === "admin"
                            ? "bg-accent-100 text-accent-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                      {m.inviteCode ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 데이터 갱신 */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-800">데이터 갱신 (월 1회 배치)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">도매몰 상품 캐시</p>
            <p className="mt-1 text-xs text-slate-400">
              최근 갱신:{" "}
              {crawledAt ? new Date(crawledAt).toLocaleDateString("ko-KR") : "이력 없음"}
              {isSample && " (샘플)"}
            </p>
            <button
              type="button"
              disabled
              title="W2에서 구현"
              className="mt-3 w-full cursor-not-allowed rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-300"
            >
              크롤러 실행 (W2)
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">홈쇼핑모아 방송 지표</p>
            <p className="mt-1 text-xs text-slate-400">최근 갱신: 이력 없음</p>
            <button
              type="button"
              disabled
              title="W2에서 구현"
              className="mt-3 w-full cursor-not-allowed rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-300"
            >
              지표 크롤러 실행 (W2)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
