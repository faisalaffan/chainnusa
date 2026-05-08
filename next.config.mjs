/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle for Docker/standalone deploys.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
