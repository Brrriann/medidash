import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 도매몰 상품 이미지(캐시 표시용) 등 외부 이미지는 W2에서 remotePatterns로 추가
  //
  // ⚠️ 정적 자산 캐시 헤더는 여기(headers())에 넣지 말 것.
  // OpenNext가 public/ 파일을 Cloudflare Workers Assets로 서빙해서 Next의 headers()가
  // 안 붙는다. next start(Node)에서는 적용되는 것처럼 보여 더 헷갈린다.
  // → `public/_headers` 에 규칙을 적는다 (workerd 실측으로 확인).
};

export default nextConfig;
