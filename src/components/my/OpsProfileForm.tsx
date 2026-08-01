"use client";

import { useActionState, useState } from "react";
import { saveOpsProfileAction, type OpsProfileState } from "@/app/(dashboard)/my/actions";
import type { OpsProfile, SalesChannel } from "@/lib/ops-profile";

const initial: OpsProfileState = { error: null, saved: false };

/** 자주 쓰는 몰 — 직접 입력도 되게 datalist로 제안만 한다 */
const PLATFORMS = ["쿠팡", "스마트스토어", "11번가", "지마켓", "옥션", "카카오톡 스토어"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function OpsProfileForm({ profile }: { profile: OpsProfile }) {
  const [state, formAction, pending] = useActionState(saveOpsProfileAction, initial);
  // 채널은 개수가 가변이라 클라이언트 상태로 행을 관리한다. 값 자체는 form이 들고 있다.
  const [channels, setChannels] = useState<SalesChannel[]>(
    profile.channels.length ? profile.channels : [{ platform: "", storeName: "", url: "" }],
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="브랜드/상호명 *" hint="답변 서명에 들어갑니다">
          <input name="brandName" defaultValue={profile.brandName} required className={inputCls} placeholder="예: 헬스몰" />
        </Field>
        <Field label="취급 카테고리">
          <input name="category" defaultValue={profile.category} className={inputCls} />
        </Field>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">판매 몰</span>
          <button
            type="button"
            onClick={() => setChannels((c) => [...c, { platform: "", storeName: "", url: "" }])}
            className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            + 몰 추가
          </button>
        </div>
        <p className="mb-2 text-[11px] text-slate-400">
          고객이 어느 몰에서 샀는지에 따라 안내가 달라집니다. 쓰시는 몰을 모두 넣어주세요.
        </p>
        <datalist id="platforms">
          {PLATFORMS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <div className="space-y-2">
          {channels.map((c, i) => (
            // grid로 폭을 잡는다. flex + w-32 조합은 inputCls의 w-full과 충돌해
            // 입력칸이 각각 컨테이너 100%를 차지하면서 가로 스크롤이 생겼다.
            // 모바일에서는 한 줄에 셋이 안 들어가므로 세로로 쌓는다.
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[8rem_10rem_minmax(0,1fr)_auto]"
            >
              <input
                name={`channel-${i}-platform`}
                defaultValue={c.platform}
                list="platforms"
                placeholder="몰"
                className={inputCls}
              />
              <input
                name={`channel-${i}-storeName`}
                defaultValue={c.storeName}
                placeholder="스토어명"
                className={inputCls}
              />
              <input
                name={`channel-${i}-url`}
                defaultValue={c.url}
                placeholder="스토어 주소 (선택)"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setChannels((x) => x.filter((_, j) => j !== i))}
                aria-label={`${i + 1}번째 몰 삭제`}
                className="rounded-lg px-2 text-slate-300 transition hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label="배송 정책 *" hint="출고 시점·택배사·배송비. CS 문의의 대부분이 배송입니다">
        <textarea
          name="shipping"
          defaultValue={profile.shipping}
          required
          rows={3}
          className={inputCls}
          placeholder="예: 평일 오후 2시 이전 주문 시 당일 출고, CJ대한통운, 3만원 이상 무료배송"
        />
      </Field>

      <Field label="교환·반품 정책">
        <textarea
          name="returns"
          defaultValue={profile.returns}
          rows={3}
          className={inputCls}
          placeholder="예: 수령 후 7일 이내, 단순 변심 왕복 배송비 6,000원 고객 부담, 개봉 시 교환·반품 불가"
        />
      </Field>

      <Field label="그 밖에 반영할 것" hint="말투, 자주 나가는 안내 문구 등">
        <textarea
          name="notes"
          defaultValue={profile.notes}
          rows={2}
          className={inputCls}
          placeholder="예: 정중한 존댓말, 답변 끝에 '건강한 하루 되세요' 를 붙임"
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}
      {state.saved && !state.error && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          저장했습니다. CS 답변에 바로 반영됩니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "운영 프로필 저장"}
      </button>
    </form>
  );
}
