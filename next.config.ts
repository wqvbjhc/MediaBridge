import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// 仅在 Cloudflare Workers 本地开发时初始化 OpenNext 适配器；
// HF Spaces / 普通 Node 环境跳过，避免找不到模块或副作用。
if (process.env.NODE_ENV === "development" && process.env.CF_PAGES) {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
