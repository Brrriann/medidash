"use client";

import { useMemo, useState, useTransition } from "react";
import {
  calcMargin,
  COUPANG_FEE_PRESETS,
  NAVER_FEE_PRESETS,
  INCOME_TAX_PRESETS,
  type MarginInputs,
  type MarginPlatform,
} from "@/lib/margin";
import { saveMarginCalc } from "@/app/(dashboard)/margin/actions";

const won = (n: number) =>
  Number.isFinite(n) ? `${Math.round(n).toLocaleString("ko-KR")}원` : "—";
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function MarginCalculator({
  initialCost,
  productRef,
  mock,
}: {
  initialCost: number | null;
  productRef: number | null;
  mock: boolean;
}) {
  const [platform, setPlatform] = useState<MarginPlatform>("coupang");
  const [price, setPrice] = useState(initialCost ? Math.ceil((initialCost * 2) / 100) * 100 : 25000);
  const [cost, setCost] = useState(initialCost ?? 12500);
  const [customerShipping, setCustomerShipping] = useState(0);
  const [paidShipping, setPaidShipping] = useState(3000);
  const [packaging, setPackaging] = useState(0);
  const [feePct, setFeePct] = useState(9.6); // 화면은 %, 계산은 소수
  const [taxRate, setTaxRate] = useState(0.06);

  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const inputs: MarginInputs = useMemo(
    () => ({
      price, cost, customerShipping, paidShipping, packaging,
      feeRate: feePct / 100, platform, incomeTaxRate: taxRate,
    }),
    [price, cost, customerShipping, paidShipping, packaging, feePct, platform, taxRate],
  );
  const r = useMemo(() => calcMargin(inputs), [inputs]);

  const presets = platform === "coupang" ? COUPANG_FEE_PRESETS : NAVER_FEE_PRESETS;
  const positive = r.finalMargin >= 0;

  const switchPlatform = (p: MarginPlatform) => {
    setPlatform(p);
    setFeePct(p === "coupang" ? 9.6 : 5.74); // 플랫폼 기본 수수료율
  };

  const save = () => {
    setSaveMsg(null);
    startSave(async () => {
      const res = await saveMarginCalc(inputs, productRef);
      setSaveMsg(res.ok ? "저장되었습니다 — 아래 히스토리에서 확인하세요." : res.error);
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[5fr_4fr]">
      {/* ── 입력 ── */}
      <div className="space-y-4 card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">입력</h2>
          {/* 플랫폼 */}
          <div className="flex gap-1">
            {(["coupang", "naver"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => switchPlatform(p)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  platform === p
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 text-slate-500 hover:border-brand-400"
                }`}
              >
                {p === "coupang" ? "쿠팡" : "네이버(스마트스토어)"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="판매가" suffix="원">
            <input {...numAttrs(price, setPrice)} />
          </Field>
          <Field label="상품원가 (도매가)" suffix="원">
            <input {...numAttrs(cost, setCost)} />
          </Field>
          <Field label="고객배송비 (수취)" suffix="원">
            <input {...numAttrs(customerShipping, setCustomerShipping)} />
          </Field>
          <Field label="지불배송비" suffix="원">
            <input {...numAttrs(paidShipping, setPaidShipping)} />
          </Field>
          <Field label="포장비용" suffix="원">
            <input {...numAttrs(packaging, setPackaging)} />
          </Field>
          <Field label="수수료율" suffix="%">
            <input {...numAttrs(feePct, setFeePct, 0.1)} />
          </Field>
        </div>

        {/* 수수료 프리셋 */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-slate-400">
            {platform === "coupang" ? "쿠팡 카테고리 (VAT 별도 → ×1.1 자동)" : "네이버 등급 (VAT 포함)"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setFeePct(Number((p.rate * 100).toFixed(3)))}
                className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-700"
              >
                {p.label} {(p.rate * 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </div>

        {/* 종소세율 */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">종합소득세율</span>
          <select
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {INCOME_TAX_PRESETS.map((t) => (
              <option key={t.rate} value={t.rate}>{t.label}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={save}
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
        {saveMsg && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{saveMsg}</p>}
      </div>

      {/* ── 결과 ── */}
      <div className="space-y-3">
        <div className={`rounded-2xl border p-6 shadow-sm ${positive ? "border-brand-200 bg-brand-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-xs font-medium text-slate-500">최종마진 (종소세 제외) / 최종마진율</p>
          <p className={`mt-1 text-2xl font-extrabold ${positive ? "text-brand-700" : "text-red-600"}`}>
            {won(r.finalMargin)} <span className="text-base font-bold">({pct(r.finalMarginRate)})</span>
          </p>
          {!positive && <p className="mt-1 text-xs text-red-500">손해 구간입니다 — 판매가/원가를 조정하세요.</p>}
        </div>

        <dl className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          <Row k="판매마진 (종소세 전)" v={won(r.salesMargin)} sub={pct(r.salesMarginRate)} />
          <div className="border-t border-slate-100 pt-2">
            <Row k={`수수료 (${platform === "coupang" ? "쿠팡 ×1.1" : "네이버"})`} v={won(r.fee)} />
            <Row k="부가세 (순 = 매출−매입 VAT)" v={won(r.vat)} />
            <Row k="종합소득세" v={won(r.incomeTax)} />
          </div>
        </dl>

        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          고객 제공 엑셀 &ldquo;세금 제외 실패없는 마진계산기&rdquo; 수식을 그대로 이식했습니다 (동일 입력 → 동일 출력).
          쿠팡은 카테고리 수수료율에 부가세(×1.1)가 자동 반영됩니다.
        </p>
      </div>
    </div>
  );
}

// ── 프레젠테이션 헬퍼 ──

function Field({ label, suffix, children }: { label: string; suffix: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      </div>
    </label>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-800">
        {v}
        {sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{sub}</span>}
      </dd>
    </div>
  );
}

function numAttrs(value: number, set: (n: number) => void, step = 100): React.InputHTMLAttributes<HTMLInputElement> {
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
