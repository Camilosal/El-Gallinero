import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return ["semilla", "ciclo-60d", "semestral-ponedora", "mediano-mensual"].map((slug) => ({
      source: `/planes/${slug}`,
      destination: "/planes#calculadora",
      permanent: true,
    }));
  },
};

export default nextConfig;
