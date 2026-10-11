/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  eslint: {
    // Lint is run explicitly in the Gate 4 protocol; do not fail the production build on lint.
    ignoreDuringBuilds: true,
  },
  experimental: {
    /**
     * Native/engine-backed modules must be required at runtime instead of bundled:
     *   - @node-rs/argon2 ships a prebuilt .node binary per platform
     *   - @prisma/client loads its query engine from disk
     *   - bullmq/ioredis open real sockets
     * Bundling any of these produces a webpack "Unexpected character" failure or a
     * runtime engine-not-found error in the standalone output.
     */
    serverComponentsExternalPackages: [
      "@node-rs/argon2",
      "@prisma/client",
      "prisma",
      "bullmq",
      "ioredis",
    ],
  },
};

export default nextConfig;
