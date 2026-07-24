import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 기본 구성 — ISR 캐시 등은 필요 시(W4 배포 단계) R2/KV 바인딩으로 확장
export default defineCloudflareConfig();
