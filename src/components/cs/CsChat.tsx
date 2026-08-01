"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { askCsAction } from "@/app/(dashboard)/cs/actions";
import type { CsTurn } from "@/lib/ai/cs";

interface Msg extends CsTurn {
  /** 금지어가 치환된 답변임을 표시 */
  sanitized?: boolean;
}

const EXAMPLES = [
  "주문했는데 배송이 언제 오나요?",
  "개봉했는데 반품 가능한가요?",
  "이거 먹으면 관절 안 아파지나요?",
];

export function CsChat({ ready, missing }: { ready: boolean; missing: string[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending || !ready) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setPending(true);

    const res = await askCsAction(next.map(({ role, content }) => ({ role, content })));
    setPending(false);
    if (res.ok) {
      setMsgs([...next, { role: "assistant", content: res.text, sanitized: res.sanitized }]);
    } else {
      setError(res.error);
      // 실패한 질문은 남겨둔다 — 사용자가 다시 치지 않아도 되게 입력창에 되돌린다.
      setMsgs(msgs);
      setInput(q);
    }
  }

  async function copy(text: string, i: number) {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="card flex h-[600px] flex-col">
      {/* 대화 영역 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-400">고객 문의를 붙여넣으면 답변을 만들어 드립니다</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={!ready}
                  onClick={() => send(e)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-40"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={() => copy(m.content, i)}
                    className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline"
                  >
                    {copied === i ? "복사됨" : "복사"}
                  </button>
                  {m.sanitized && (
                    <span className="text-[11px] text-amber-600">
                      광고 안전 표현으로 일부 치환됨
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="max-w-[85%] rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">
            답변을 만드는 중…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-slate-100 p-4">
        {!ready && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <span>
              <strong>{missing.join(" · ")}</strong>이(가) 설정되어야 답변을 만들 수 있습니다.
            </span>
            <Link
              href="/my#ops-profile"
              className="font-semibold underline underline-offset-2"
            >
              운영 프로필 설정 →
            </Link>
          </div>
        )}
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter로 전송. 그냥 Enter는 줄바꿈이라 긴 문의를 붙여넣기 좋다.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(input);
            }}
            disabled={!ready || pending}
            rows={2}
            placeholder={
              ready ? "고객 문의를 붙여넣으세요" : "운영 프로필 설정 후 이용할 수 있습니다"
            }
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!ready || pending || !input.trim()}
            className="shrink-0 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            보내기
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Cmd/Ctrl + Enter로 전송</span>
          {msgs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMsgs([]);
                setError(null);
              }}
              className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              대화 초기화
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
