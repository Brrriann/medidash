"use client";

import { useActionState, useState } from "react";
import {
  generateTitlesAction,
  type TitlesState,
} from "@/app/(dashboard)/titles/actions";
import type { Exposure, KeywordStat } from "@/lib/titles/types";
import { AI_DISCLAIMER } from "@/lib/constants";

const initial: TitlesState = { result: null, error: null };

const EXPOSURE_STYLE: Record<Exposure, string> = {
  상: "bg-brand-600 text-white",
  중: "bg-accent-100 text-accent-700",
  하: "bg-slate-100 text-slate-500",
};

export function TitleGenerator({
  defaults,
  bodyParts,
}: {
  defaults: { ingredient: string; bodyPart: string };
  bodyParts: string[];
}) {
  const [state, action, pending] = useActionState(generateTitlesAction, initial);
  const [platform, setPlatform] = useState<"coupang" | "smartstore">("coupang");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* 클립보드 미지원 무시 */
    }
  };

  const r = state.result;

  return (
    <div className="grid gap-5 md:grid-cols-[5fr_7fr]">
      {/* 입력 */}
      <form action={action} className="space-y-4 card p-6">
        <h2 className="text-sm font-bold text-slate-800">입력</h2>

        <Field label="대표 원료" required>
          <input
            name="ingredient"
            defaultValue={defaults.ingredient}
            required
            placeholder="예: 루테인 지아잔틴"
            className={inputCls}
          />
        </Field>

        <Field label="부위/효능 (선택)">
          <input
            name="bodyPart"
            defaultValue={defaults.bodyPart}
            list="bodyparts"
            placeholder="예: 눈 건강"
            className={inputCls}
          />
          <datalist id="bodyparts">
            {bodyParts.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="브랜드 (선택)">
            <input name="brand" placeholder="예: 아이케어" className={inputCls} />
          </Field>
          <Field label="규격 (선택)">
            <input name="spec" placeholder="예: 60캡슐" className={inputCls} />
          </Field>
        </div>

        <Field label="제품 특징 (선택)">
          <input name="productHint" placeholder="예: 고함량, 1일 1캡슐" className={inputCls} />
        </Field>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">플랫폼</span>
          <div className="flex gap-2">
            {(["coupang", "smartstore"] as const).map((p) => (
              <label
                key={p}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold transition ${
                  platform === p
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-300 text-slate-500 hover:border-brand-400"
                }`}
              >
                <input
                  type="radio"
                  name="platform"
                  value={p}
                  checked={platform === p}
                  onChange={() => setPlatform(p)}
                  className="sr-only"
                />
                {p === "coupang" ? "쿠팡" : "스마트스토어"}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "생성 중…" : "상품명·태그 생성"}
        </button>
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
        )}
      </form>

      {/* 결과 */}
      <div className="space-y-4">
        {!r ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 text-center">
            <p className="text-sm font-semibold text-slate-500">원료를 입력하고 생성하세요</p>
            <p className="mt-1 text-xs text-slate-600">
              상품명 3~5안(노출도 상/중/하) + 태그 20개가 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <>
            {r.sanitized && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                ⚠️ 의약품 오인 우려 표현(치료·예방 등)이 광고 안전 표현으로 자동 치환되었습니다.
              </div>
            )}

            <MarketSignal stat={r.keywordStat} usable={r.usableRelated ?? []} />

            {/* 상품명 */}
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">상품명 {r.titles.length}안</h2>
                <span className="text-xs text-slate-600">노출도 상/중/하</span>
              </div>
              <ul className="space-y-2">
                {r.titles.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${EXPOSURE_STYLE[t.exposure]}`}
                    >
                      {t.exposure}
                    </span>
                    <span className="flex-1 text-sm text-slate-800">{t.text}</span>
                    <CopyBtn onClick={() => copy(t.text, `t${i}`)} copied={copied === `t${i}`} />
                  </li>
                ))}
              </ul>
            </section>

            {/* 태그 */}
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">태그 {r.tags.length}개</h2>
                <button
                  type="button"
                  onClick={() => copy(r.tags.join(", "), "alltags")}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {copied === "alltags" ? "복사됨 ✓" : "전체 복사"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => copy(tag, `tag${i}`)}
                    title="클릭하여 복사"
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      copied === `tag${i}`
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-400"
                    }`}
                  >
                    {copied === `tag${i}` ? "복사됨 ✓" : `#${tag}`}
                  </button>
                ))}
              </div>
            </section>

            <p className="px-1 text-xs leading-relaxed text-slate-600">{AI_DISCLAIMER}</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 네이버 실측 시장 신호. 노출도 등급이 왜 그렇게 나왔는지 근거를 보여준다.
 * 수요·경쟁은 **키워드의 속성**이라 등급에는 안 섞고 여기서 따로 보여준다.
 */
function MarketSignal({
  stat,
  usable,
}: {
  stat: KeywordStat | null | undefined;
  usable: { term: string; count: number }[];
}) {
  if (!stat) return null;
  const demand = stat.demandIndex;
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">시장 신호</h2>
        <span className="text-xs text-slate-600">네이버 검색·쇼핑 실측 · 월 1회 갱신</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs text-slate-600">검색 수요</p>
          <p className="mt-0.5 text-sm font-bold text-slate-800">
            {demand == null ? "—" : `${demand.toFixed(2)}×`}
          </p>
          <p className="mt-0.5 text-xs leading-tight text-slate-600">
            콜라겐 대비 12개월 평균
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs text-slate-600">경쟁 상품수</p>
          <p className="mt-0.5 text-sm font-bold text-slate-800">
            {stat.competition == null ? "—" : stat.competition.toLocaleString("ko-KR")}
          </p>
          <p className="mt-0.5 text-xs leading-tight text-slate-600">
            네이버쇼핑 등록 기준
          </p>
        </div>
      </div>

      {usable.length > 0 && (
        <div className="mt-3.5">
          <p className="mb-1.5 text-xs text-slate-500">
            상위 노출 상품이 쓰는 단어 —{" "}
            <span className="text-slate-600">상품명에 넣을수록 노출도가 올라갑니다</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {usable.slice(0, 12).map((r) => (
              <span
                key={r.term}
                className="rounded bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {r.term}
                <span className="ml-1 text-xs text-brand-500/70">{r.count}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            타사 브랜드명·제형어(캡슐·프리미엄 등)는 자동으로 제외했습니다. 경쟁 상품수는
            네이버쇼핑 전체 기준이라, 원료명이 일반 식품명과 겹치면(마카·녹차 등) 실제보다
            크게 잡힐 수 있습니다.
          </p>
        </div>
      )}
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function CopyBtn({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
        copied
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}
