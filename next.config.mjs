/** @type {import('next').NextConfig} */
const nextConfig = {
  // O Mantine (usado pelo editor BlockNote da Wiki) pede transpile explícito
  // em alguns setups do Next.js.
  transpilePackages: ["@mantine/core", "@mantine/hooks"],
};

export default nextConfig;
