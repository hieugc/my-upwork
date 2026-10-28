import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Default remains static portfolio build. Live Task Control is separately built
// with STATIC_EXPORT=0 and exposed only on loopback.
const dynamicTaskControl = process.env.STATIC_EXPORT === "0";
const rawPort = process.env.TASK_CONTROL_QA_GATEWAY_PORT;
const port = rawPort && /^\d{2,5}$/.test(rawPort) &&
  Number(rawPort) >= 1024 && Number(rawPort) <= 65535 ? Number(rawPort) : 8090;
const gatewayBase = `http://127.0.0.1:${port}`;

const nextConfig: NextConfig = {
  ...(dynamicTaskControl ? {} : { output: "export" as const }),
  basePath,
  assetPrefix: basePath || undefined,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { unoptimized: true },
  ...(dynamicTaskControl ? {
    async rewrites() {
      return [
        { source: "/mcp-admin/:path*", destination: `${gatewayBase}/api/admin/:path*` },
        { source: "/mcp-workflows/:path*", destination: `${gatewayBase}/api/workflows/:path*` },
      ];
    },
  } : {}),
};

export default nextConfig;
