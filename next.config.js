const nextConfig = {
  experimental: {
    appDir: true,
    mdxRs: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

const withMDX = require("@next/mdx")();
module.exports = withMDX(nextConfig);
