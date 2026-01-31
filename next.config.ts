import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from inferring an incorrect workspace root (which can
  // cause it to scan parent folders like ~/Desktop and crash on macOS perms).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
