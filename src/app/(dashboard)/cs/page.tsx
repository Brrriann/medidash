import type { Metadata } from "next";
import Link from "next/link";
import { getOpsProfile } from "@/lib/data";
import { getAiQuota } from "@/lib/ai/quota";
import { isOpsProfileReady, missingOpsFields } from "@/lib/ops-profile";
import { PageHeader } from "@/components/ui/PageHeader";
import { CsChat } from "@/components/cs/CsChat";

export const metadata: Metadata = { title: "CS 답변" };

export default async function CsPage() {
  const [ops, quota] = await Promise.all([getOpsProfile(), getAiQuota()]);
  const ready = isOpsProfileReady(ops);
  const missing = missingOpsFields(ops);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="CS 답변"
        description="고객 문의를 붙여넣으면 내 운영 정책에 맞는 답변 초안을 만들어 드립니다. 의약품 오인 표현은 광고 안전 표현으로 자동 치환됩니다."
        aside={
          !quota.unlimited ? (
            <span className="inline-flex rounded bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              오늘 {Math.max(quota.text.limit - quota.text.used, 0)}회 남음
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
        {/* 답변의 근거가 되는 프로필을 옆에 띄워둔다 — 답이 이상하면 여기가 원인이다. */}
        <section className="card h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">운영 프로필</h2>
            <Link
              href="/my#ops-profile"
              className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline"
            >
              수정
            </Link>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">브랜드/상호명</dt>
              <dd className={ops.brandName ? "font-semibold text-slate-800" : "text-amber-600"}>
                {ops.brandName || "미설정"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">판매 몰</dt>
              <dd className="text-slate-700">
                {ops.channels.length ? (
                  <span className="flex flex-wrap gap-1 pt-0.5">
                    {ops.channels.map((c, i) => (
                      <span
                        key={i}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {c.platform}
                        {c.storeName && ` · ${c.storeName}`}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-400">미설정</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">배송 정책</dt>
              <dd
                className={`whitespace-pre-wrap text-xs leading-relaxed ${
                  ops.shipping ? "text-slate-700" : "text-amber-600"
                }`}
              >
                {ops.shipping || "미설정"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">교환·반품 정책</dt>
              <dd className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                {ops.returns || <span className="text-slate-400">미설정</span>}
              </dd>
            </div>
          </dl>

          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
            답변은 위 정책 안에서만 만들어집니다. 정책에 없는 내용을 물으면 지어내지 않고
            &ldquo;확인 후 안내&rdquo;로 답합니다.
          </p>
        </section>

        <CsChat ready={ready} missing={missing} />
      </div>
    </div>
  );
}
