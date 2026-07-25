import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 도매몰 상품 이미지(캐시 표시용) 등 외부 이미지는 W2에서 remotePatterns로 추가

  async headers() {
    return [
      {
        // 3D 인체 모델(7.6MB)은 홈의 메인 콘텐츠라 첫 방문자 전원이 받는다.
        // public/ 파일은 파일명에 해시가 없어 Next가 `immutable`을 안 붙이고
        // `max-age=0`으로 내보내므로, 방문마다 재검증 왕복이 생긴다.
        //
        // 해시가 없으니 `immutable`은 쓰지 않는다 — 모델을 교체했는데 1년간 옛 파일이
        // 물려 있으면 손쓸 방법이 없다. 대신 7일 캐시 + 30일 stale-while-revalidate로
        // 재검증을 줄이되 교체가 일주일 안에 반영되게 한다.
        // 더 줄이고 싶으면 파일명에 버전을 넣고(body.v2.glb) immutable로 올리면 된다.
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
