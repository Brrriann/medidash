import type { ReactNode } from "react";

/**
 * 페이지 상단 머리글.
 *
 * 화면마다 제각각이던 `<h1>` + `<p>` 묶음을 하나로 통일한다.
 * 문법은 **원장의 표제** — 한글 타이틀 + 설명 한 줄, 아래에 굵은 괘선.
 *
 * 종전에는 영문 대문자 오버라인 배지(`WHOLESALE SOURCING` 등)를 달았는데 뺐다.
 * 그 화면이 어느 갈래인지는 사이드바가 이미 그룹 제목과 함께 보여주고 있어서
 * 배지는 같은 정보를 두 번 말하는 자리였다.
 *
 * 카드로 감싸지도 않는다. 머리글이 상자 안에 들어가면 본문 카드와 같은 층에 놓여
 * 표제로 안 읽힌다. 괘선 하나로 본문과 가른다.
 *
 * `aside`에는 갱신일·건수 같은 메타나 액션 버튼을 넣는다.
 */
export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-slate-900 pb-3">
      {/* 넓은 화면: flex-1(basis 0)로 두어야 설명 문단이 제 폭을 주장하지 않는다.
          min-w-0 만 주면 문단이 max-w만큼 자리를 잡아 aside가 아래 줄로 밀린다.
          좁은 화면: basis-full로 한 줄을 다 써서 aside를 아래로 떨어뜨린다 —
          안 그러면 배지가 설명 마지막 줄 옆에 끼어 글이 그 주위를 감싸는 꼴이 된다. */}
      <div className="min-w-0 flex-1 basis-full sm:basis-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0 pb-0.5">{aside}</div>}
    </header>
  );
}
