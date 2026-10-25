import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export → deploy the `out/` folder to Cloudflare Pages
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
