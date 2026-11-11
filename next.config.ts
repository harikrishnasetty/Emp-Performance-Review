import type { NextConfig } from "next";

/**
 * Meridian — Next.js configuration.
 *
 * Hardening notes:
 *  - `output: "standalone"` produces a minimal image for the Docker build.
 *  - `poweredByHeader: false` removes the framework fingerprint.
 *  - Security headers are also emitted by nginx; keeping them here protects
 *    deployments that skip the reverse proxy (e.g. local dev, smoke tests).
 */
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "graph.microsoft.com" },
      { protocol: "https", hostname: "**.microsoftonline.com" },
      { protocol: "https", hostname: "**.metricstream.com" },
    ],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const cspReportOnly = process.env.CSP_REPORT_ONLY === "true";

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next.js injects inline bootstrap scripts; unsafe-inline is stripped in
      // favour of nonces by the middleware for document requests.
      "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            key: cspReportOnly
              ? "Content-Security-Policy-Report-Only"
              : "Content-Security-Policy",
            value: csp,
          },
        ],
      },
      {
        // API responses must never be cached by intermediaries.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
