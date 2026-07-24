/**
 * 크롤링 매너 유틸 (docs/SPEC.md §6.2·§11)
 * 요청 간 딜레이 2~5초 랜덤 · 동시성 1(순차) · 재시도 2회 · 실패는 로그만.
 * 대상 사이트 부하 최소화가 최우선이며, 이 규칙은 파서보다 상위에서 강제한다.
 */

const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 5000;
const MAX_RETRIES = 2;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 요청 간 2~5초 랜덤 딜레이 */
export function politeDelay(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
  return sleep(ms);
}

/** 재시도 2회 (지수 백오프). 최종 실패 시 예외를 던진다(호출부에서 로그만 남기고 계속). */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoff = 1000 * 2 ** attempt;
        console.warn(`  ↻ 재시도 ${attempt + 1}/${retries} — ${label}: ${errMsg(err)} (${backoff}ms 후)`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(`${label} 실패(재시도 ${retries}회 초과): ${errMsg(lastError)}`);
}

/**
 * 항목을 동시성 1로 순차 처리하며 각 항목 사이에 매너 딜레이.
 * 개별 실패는 삼켜서 로그만 남기고 다음 항목으로 진행(서비스 무영향 — §10 인수 기준).
 */
export async function runSequential<TIn, TOut>(
  items: TIn[],
  handler: (item: TIn, index: number) => Promise<TOut>,
  { onError }: { onError?: (item: TIn, err: unknown) => void } = {},
): Promise<TOut[]> {
  const out: TOut[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await politeDelay();
    try {
      out.push(await handler(items[i], i));
    } catch (err) {
      onError?.(items[i], err);
    }
  }
  return out;
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
