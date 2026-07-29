import type { ReactNode } from "react";

/**
 * 페이지 상단 헤더 카드.
 *
 * 화면마다 제각각이던 `<h1>` + `<p>` 묶음을 하나로 통일한다.
 * 문법은 영문 대문자 오버라인 배지 + 큰 한글 타이틀 + 설명 한 줄.
 * 오버라인은 그 화면이 무엇을 다루는지 한눈에 잡아주는 라벨이라 짧을수록 좋다.
 *
 * `aside`에는 갱신일·건수 같은 메타나 액션 버튼을 넣는다.
 */
export function PageHeader({
  overline,
  title,
  description,
  aside,
}: {
  overline: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="card flex flex-wrap items-start justify-between gap-4 px-6 py-5">
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
          {overline}
        </span>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
