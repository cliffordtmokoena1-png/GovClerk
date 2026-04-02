/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "igc.clerk.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        destination: "/terms-of-use.html",
        source: "/legal/terms-and-conditions",
      },
      {
        destination: "/terms-of-use.html",
        source: "/legal/terms-of-use",
      },
      {
        destination: "/privacy-policy.html",
        source: "/legal/privacy-policy",
      },
      {
        destination: "/privacy-policy.html",
        source: "/legal/data-deletion-policy",
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /@ffmpeg\/ffmpeg/,
      parser: {
        commonjs: true,
      },
    });

    config.ignoreWarnings = [
      {
        module: /@ffmpeg\/ffmpeg/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

// Trigger redeployment: SQL column references fixed in PR #60 (2026-03-14)
module.exports = nextConfig;
