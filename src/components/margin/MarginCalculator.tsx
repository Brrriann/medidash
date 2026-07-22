"use client";

import { useActionState, useMemo, useState } from "react";
import { calcMargin, recommendPrice } from "@/lib/margin";
import {
  saveMarginCalc,
  type SaveMarginState,
} from "@/app/(dashboard)/margin/actions";

/** 플랫폼 수수료 프리셋 (직접 조정 가능) */
const FEE_PRESETS = [
  { label: "스마트스토어", rate: 5.5 },
  { label: "쿠팡", rate: 10.8 },
];

const initialSave: SaveMarginState = { ok: false, error: null };

const won = (n: number) =>
  Number.isFinite(n) ? `${Math.round(n).toLocaleString("ko-KR")}원` : "—";

export function MarginCalculator({
  initialCost,
  productRef,
  mock,
}: {
  initialCost: number | null;
  productRef: number | null;
  mock: boolean;
}) {
  const [cost, setCost] = useState(initialCost ?? 12500);
  const [price, setPrice] = useState(
    initialCost ? Math.ceil((initialCost * 2) / 100) * 100 : 25000,
  );
  const [feeRate, setFeeRate] = useState(5.5);
  const [shipping, setShipping] = useState(3000);
  const [extraCost, setExtraCost] = useState(0);
  const [targetRate, setTargetRate] = useState(30);

  const [saveState, saveAction, saving] = useActionState(
    saveMarginCalc,
    initialSave,
  );

  const results = useMemo(
    () => calcMargin({ cost, price, feeRate, shipping, extraCost }),
    [cost, price, feeRate, shipping, extraCost],
  );
  const recommended = useMemo(
    () => recommendPrice({ cost, feeRate, shipping, extraCost }, targetRate),
    [cost, feeRate, shipping, extraCost, targetRate],
  );

  const marginPositive = results.margin >= 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[5fr_4fr]">
      {/* ── 입력 ── */}
      <form
        action={saveAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-bold text-slate-800">입력</h2>

        <Field label="원가 (도매가)" suffix="원">
          <input {...numProps(cost, setCost)} name="cost" />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              플랫폼 수수료율
            </span>
            <div className="flex gap-1">
              {FEE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setFeeRate(p.rate)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                    feeRate === p.rate
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300 text-slate-500 hover:border-brand-400"
                  }`}
                >
                  {p.label} {p.rate}%
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <input {...numProps(feeRate, setFeeRate, 0.1)} name="feeRate" />
            <Suffix>%</Suffix>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="배송비 (판매자 부담)" suffix="원">
            <input {...numProps(shipping, setShipping)} name="shipping" />
          </Field>
          <Field label="기타비용" suffix="원">
            <input {...numProps(extraCost, setExtraCost)} name="extraCost" />
          </Field>
        </div>

        <Field label="판매가" suffix="원">
          <input {...numProps(price, setPrice)} name="price" />
        </Field>

        {/* 목표 마진율 → 권장 판매가 */}
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-accent-800">
              목표 마진율
              <input
                type="number"
                value={targetRate}
                step={1}
                onChange={(e) => setTargetRate(Number(e.target.value))}
                className="mx-1.5 w-14 rounded-md border border-accent-300 bg-white px-1.5 py-0.5 text-right text-xs"
              />
              %
            </label>
            <div className="text-right">
              <span className="block text-[10px] text-accent-600">권장 판매가</span>
              <span className="text-sm font-bold text-accent-800">
                {recommended === null ? "산출 불가" : won(recommended)}
              </span>
            </div>
          </div>
          {recommended !== null && (
            <button
              type="button"
              onClick={() => setPrice(recommended)}
              className="mt-2 w-full rounded-lg border border-accent-300 bg-white py-1.5 text-xs font-semibold text-accent-700 transition hover:bg-accent-100"
            >
              권장가를 판매가에 적용
            </button>
          )}
        </div>

        <input type="hidden" name="productRef" value={productRef ?? 0} />

        <button
          type="submit"
          disabled={mock || saving}
          className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "저장 중…" : "계산 결과 저장"}
        </button>
        {mock && (
          <p className="text-center text-[11px] text-slate-400">
            Mock 모드 — Supabase 연결 후 저장·히스토리가 활성화됩니다
          </p>
        )}
        {saveState.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {saveState.error}
          </p>
        )}
        {saveState.ok && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            저장되었습니다 — 아래 히스토리에서 확인하세요.
          </p>
        )}
      </form>

      {/* ── 결과 ── */}
      <div className="space-y-3">
        <div
          className={`rounded-2xl border p-6 shadow-sm ${
            marginPositive
              ? "border-brand-200 bg-brand-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-xs font-medium text-slate-500">마진액 / 마진율</p>
          <p
            className={`mt-1 text-2xl font-extrabold ${
              marginPositive ? "text-brand-700" : "text-red-600"
            }`}
          >
            {won(results.margin)}{" "}
            <span className="text-base font-bold">({results.marginRate}%)</span>
          </p>
          {!marginPositive && (
            <p className="mt-1 text-xs text-red-500">
              손해 구간입니다 — 판매가를 손익분기 이상으로 올리세요.
            </p>
          )}
        </div>

        <dl className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          <Row k="부가세 (원가×10%)" v={won(results.vat)} />
          <Row k="총원가 (원가+부가세+배송+기타)" v={won(results.totalCost)} />
          <Row k={`플랫폼 수수료 (${feeRate}%)`} v={won(results.fee)} />
          <div className="border-t border-slate-100 pt-2">
            <Row
              k="손익분기 판매가"
              v={won(results.breakEvenPrice)}
              strong
            />
          </div>
        </dl>

        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          v1 표준 수식 기준입니다. 고객 제공 엑셀 수령 후 동일 입력 → 동일 출력(±0원)으로
          수식이 교체됩니다 (src/lib/margin.ts).
        </p>
      </div>
    </div>
  );
}

// ── 소소한 프레젠테이션 헬퍼 ──

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <div className="relative">
        {children}
        <Suffix>{suffix}</Suffix>
      </div>
    </label>
  );
}

function Suffix({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
      {children}
    </span>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className={strong ? "font-bold text-slate-800" : "text-slate-700"}>
        {v}
      </dd>
    </div>
  );
}

function numProps(
  value: number,
  set: (n: number) => void,
  step = 100,
): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    type: "number",
    value,
    step,
    min: 0,
    onChange: (e) => set(Number(e.currentTarget.value)),
    className:
      "w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
  };
}
