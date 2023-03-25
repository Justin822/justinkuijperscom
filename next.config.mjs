import addMdx from "@next/mdx";

addMdx(nextConfig, {
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "mdx"],
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
