const { withContentlayer } = require("next-contentlayer2");

// Versie van deze build, voor de cache van de service worker (elke deploy een verse cache).
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) || Date.now().toString(36);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

module.exports = withContentlayer(nextConfig);
