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

module.exports = nextConfig;
