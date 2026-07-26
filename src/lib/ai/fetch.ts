import "server-only";

/**
 * OpenAI 호출 전용 fetch.
 *
 * **왜 그냥 fetch를 안 쓰는가**
 * 한국 트래픽이 Cloudflare 홍콩(HKG) PoP로 라우팅되는데 OpenAI가 홍콩을 차단한다
 * (403 unsupported_country_region_territory). 사용자는 한국(지원 국가)인데 Worker가
 * 홍콩에서 나가서 막혔다. Smart Placement로는 안 풀렸다.
 *
 * Durable Object는 생성 시 지역을 고정할 수 있어서(locationHint), OpenAI 호출만
 * 북미에 고정된 DO를 거치게 한다. 나머지 요청은 종전대로 사용자 근처 엣지에서 처리된다.
 *
 * 바인딩이 없는 환경(로컬 dev·테스트)에서는 그냥 fetch로 떨어진다 — 로컬은 지역 문제가 없다.
 */

/**
 * DO 바인딩의 최소 형태만 직접 선언한다.
 * @cloudflare/workers-types를 tsconfig types에 넣으면 DOM 타입(Response.json 등)을 덮어써
 * 앱 코드가 깨진다 — 실제로 ThumbnailStudio가 컴파일 실패했다.
 */
interface OpenAIProxyNamespace {
  idFromName(name: string): unknown;
  get(id: unknown, opts?: { locationHint?: string }): { fetch: typeof fetch };
}
async function proxyStub(): Promise<{ fetch: typeof fetch } | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = (await getCloudflareContext({ async: true })).env as unknown as {
      OPENAI_PROXY?: OpenAIProxyNamespace;
    };
    const ns = env.OPENAI_PROXY;
    if (!ns) return null;
    // 이름을 고정하면 인스턴스가 하나로 모여 재사용된다. 지역은 최초 생성 시 wnam(북미)으로 굳는다.
    const id = ns.idFromName("openai");
    return ns.get(id, { locationHint: "wnam" });
  } catch {
    return null;
  }
}

export async function openaiFetch(url: string, init: RequestInit): Promise<Response> {
  const stub = await proxyStub();
  if (!stub) return fetch(url, init);

  // DO에 (url, init)을 넘기고 응답을 그대로 받는다. 본문은 스트림으로 흘러가므로
  // 2MB 이미지도 문자열로 부풀리지 않는다.
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => (headers[k] = v));
  return stub.fetch("https://openai-proxy.internal/", {
    method: "POST",
    body: JSON.stringify({
      url,
      init: { method: init.method ?? "GET", headers, body: init.body as string | undefined },
    }),
  });
}
