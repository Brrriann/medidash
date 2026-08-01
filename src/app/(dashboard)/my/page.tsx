import type { Metadata } from "next";
import Link from "next/link";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getAiLogs, getMarginHistory, getOpsProfile, getRecentWorks } from "@/lib/data";
import { OpsProfileForm } from "@/components/my/OpsProfileForm";
import { isOpsProfileReady, missingOpsFields } from "@/lib/ops-profile";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "내 계정" };

const WORK_LABELS: Record<string, string> = {
  thumbnail: "썸네일",
  title_tags: "상품명·태그",
  margin: "마진 계산",
  hook_page: "후킹페이지",
};

/** AI 호출 종류 → 사람이 읽는 이름 */
const AI_LABELS: Record<string, string> = {
  thumbnail_bg: "썸네일 배경 생성",
  person_cutout: "인물 컷아웃 생성",
  hook_bg: "후킹페이지 배경 생성",
  hook_copy: "후킹 문구 생성",
  title_tags: "상품명·태그 제안",
  cs_answer: "CS 답변 생성",
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

  const [works, margins, aiLogs, ops] = await Promise.all([
    getRecentWorks(),
    getMarginHistory(),
    getAiLogs(),
    getOpsProfile(),
  ]);
  const opsMissing = missingOpsFields(ops);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="내 계정"
        description="내 작업 이력과 계정을 관리합니다."
      />

      <div className="grid gap-5 md:grid-cols-[2fr_3fr]">
        {/* 계정 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">계정</h2>
          {mock ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Mock 모드 — Supabase 연결 후 로그인하면 계정 정보가 표시됩니다.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-600">이메일</p>
                <p className="text-sm font-semibold text-slate-800">
                  {email ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600">역할</p>
                <span
                  className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-semibold ${
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
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
            결제 내역은 W4(토스페이먼츠 연동)에서 제공됩니다.
          </p>
        </section>

        {/* 작업 이력 */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">작업 이력</h2>
          {works.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-600">아직 작업 이력이 없습니다</p>
              <p className="mt-1 text-xs text-slate-600">
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
                  <span className="text-xs text-slate-600">
                    {new Date(w.createdAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 운영 프로필 — CS 답변 생성의 입력 */}
      <section className="card p-5" id="ops-profile">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">운영 프로필</h2>
          {isOpsProfileReady(ops) ? (
            <span className="rounded bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              CS 답변 사용 가능
            </span>
          ) : (
            <span className="rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {opsMissing.join(" · ")} 필요
            </span>
          )}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-600">
          CS 답변은 이 정보를 근거로 만들어집니다. 배송·교환 정책이 비어 있으면 일반론만
          나와 그대로 쓰기 어렵습니다.
        </p>
        {/* mock에서도 폼을 그린다 — 화면 구조 확인이 mock의 목적인데 여기만 빠지면
            검증이 안 된다. 저장을 누르면 액션이 mock 안내를 돌려준다. */}
        <OpsProfileForm profile={ops} />
      </section>

      {/* AI 생성 이력 */}
      <section className="card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">AI 생성 이력</h2>
          <span className="text-xs text-slate-600">최근 {aiLogs.length}건</span>
        </div>
        {/* 실패도 함께 보여주는 이유를 화면에서 설명한다 — 안 그러면 "왜 실패가 목록에
            있지?"가 되고, 반대로 안 보여주면 "왜 횟수가 줄었지?"가 된다. */}
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          생성이 실패해도 AI 호출 횟수는 차감됩니다. 오늘 남은 횟수가 맞지 않을 때 여기서
          확인하실 수 있습니다.
        </p>
        {aiLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-600">
            아직 AI 생성 이력이 없습니다
            {mock && " (mock 모드 — Supabase 연결 후 활성화)"}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aiLogs.map((log) => {
              const ingredient =
                typeof log.meta.ingredient === "string" ? log.meta.ingredient : null;
              return (
                <li key={log.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                      log.ok
                        ? "bg-brand-50 text-brand-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {log.ok ? "성공" : "실패"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-700">
                      {AI_LABELS[log.kind] ?? log.kind}
                      {ingredient && (
                        <span className="ml-1.5 text-xs text-slate-600">{ingredient}</span>
                      )}
                    </span>
                    {!log.ok && log.error && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-red-500">
                        {log.error}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-600">
                    {new Date(log.createdAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
          <p className="py-6 text-center text-sm text-slate-600">
            저장된 계산이 없습니다
            {mock && " (mock 모드 — Supabase 연결 후 활성화)"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-600">
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
                    <td className="py-2 pr-4 text-xs text-slate-600">
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
