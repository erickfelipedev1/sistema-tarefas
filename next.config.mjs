/** @type {import('next').NextConfig} */
const nextConfig = {
  // O Mantine (usado pelo editor BlockNote da Wiki) pede transpile explícito
  // em alguns setups do Next.js.
  transpilePackages: ["@mantine/core", "@mantine/hooks"],
  experimental: {
    // O react-pdf (PDF da fatura) roda direto no Node, sem ser empacotado.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // As fontes do PDF são lidas do disco: precisam ir junto com a rota.
    outputFileTracingIncludes: {
      "/api/faturas/[id]/pdf": ["./lib/pdf/fonts/**/*"],
      "/api/progresso/[token]/faturas/[id]/pdf": ["./lib/pdf/fonts/**/*"],
    },
  },
};

export default nextConfig;
