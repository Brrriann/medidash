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

/** ArrayBuffer → base64 (workerd에는 Buffer가 없다). 한 번에 넘기면 스택이 터져 잘라 넣는다. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export async function openaiFetch(url: string, init: RequestInit): Promise<Response> {
  const stub = await proxyStub();
  if (!stub) return fetch(url, init);

  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => (headers[k] = v));

  let body: string | undefined;
  let bodyB64: string | undefined;

  if (init.body instanceof FormData) {
    // **multipart는 JSON 봉투에 문자열로 못 싣는다.** JSON.stringify(FormData)는 `{}`가 되어
    // 본문이 통째로 사라지고, Content-Type도 안 붙어 OpenAI가 text/plain으로 받는다
    // (실측: 씬 생성이 HTTP 400 "Unsupported content type: 'text/plain'"으로 죽었다).
    //
    // 인코딩은 플랫폼에 맡긴다 — Request가 boundary까지 붙여 주므로 그 바이트를 그대로
    // base64로 넘기고 DO에서 되돌린다.
    const encoded = new Request(url, { method: "POST", body: init.body });
    const ct = encoded.headers.get("content-type");
    if (ct) headers["content-type"] = ct;
    bodyB64 = toBase64(await encoded.arrayBuffer());
  } else if (init.body != null) {
    body = init.body as string;
  }

  return stub.fetch("https://openai-proxy.internal/", {
    method: "POST",
    body: JSON.stringify({
      url,
      init: { method: init.method ?? "GET", headers, body },
      bodyB64,
    }),
  });
}
