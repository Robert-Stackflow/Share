/** @type {import('next').NextConfig} */
const { version } = require("./package.json");

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkOnly",
    },
  ],
});

module.exports = withPWA({
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: {
    // Lint is run as a separate CI step. Running lint and TypeScript together
    // doubles peak memory during a production image build.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Keep production builds viable on small self-hosted machines. Next uses
    // this value for its worker pool instead of spawning one worker per CPU.
    cpus: 1,
    webpackBuildWorker: true,
  },
  transpilePackages: ["@uiw/react-md-editor", "@uiw/react-markdown-preview"],
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    VERSION: version,
  },
});
