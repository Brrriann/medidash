/**
 * Worker 진입점 — OpenNext가 만든 worker를 그대로 내보내고, 여기에 AI 프록시 DO를 얹는다.
 *
 * **왜 필요한가**
 * 한국 트래픽이 Cloudflare 홍콩(HKG) PoP로 라우팅되는데 OpenAI가 홍콩을 차단한다
 * (403 unsupported_country_region_territory). 사용자는 한국(지원 국가)인데 Worker가
 * 홍콩에서 나가서 막혔다. Smart Placement로는 안 풀렸다.
 *
 * Durable Object는 **생성 시 지역을 고정**할 수 있다(locationHint). OpenAI 호출만 북미에
 * 고정된 DO를 거치게 하면 출발지가 항상 지원 국가가 된다. 나머지 요청은 종전대로 사용자
 * 근처 엣지에서 처리되므로 페이지 응답 속도는 그대로다.
 *
 * `.open-next/worker.js`는 빌드마다 새로 생성되므로 **그 파일을 고치지 않고** 여기서 감싼다.
 */
import { DurableObject } from "cloudflare:workers";

// @ts-expect-error — 빌드 산출물이라 타입 선언이 없다
import handler from "./.open-next/worker.js";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
  // @ts-expect-error — 위와 동일
} from "./.open-next/worker.js";

export default handler;

/**
 * OpenAI 호출을 대신 수행하는 DO.
 *
 * 요청 본문을 그대로 받아 OpenAI에 넘기고 응답을 그대로 돌려준다. 여기서 파싱하지 않는 이유:
 * 이미지 응답은 최대 2MB인데, DO에서 문자열로 다루면 CPU와 메모리를 두 번 쓴다.
 * 스트림을 그대로 흘려보내면 프록시 비용이 거의 없다.
 */
export class OpenAIProxy extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const { url, init } = (await request.json()) as {
      url: string;
      init: { method: string; headers: Record<string, string>; body?: string };
    };
    // 화이트리스트 — DO가 임의 주소를 대신 호출하는 통로가 되면 안 된다(SSRF).
    if (!url.startsWith("https://api.openai.com/")) {
      return new Response(JSON.stringify({ error: "허용되지 않은 대상" }), { status: 400 });
    }
    return fetch(url, init);
  }
}
