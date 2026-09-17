import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "vibe NDL" (nowdigitallab.com.br): fundo quase preto com
        // leve tom esverdeado + verde-limão neon de destaque, no lugar do
        // azul/branco de antes. Valores estimados a partir de um print do
        // site (fácil de ajustar se o Erick mandar os hex exatos depois).
        navy: {
          DEFAULT: "#12160D",
          light: "#1B2213",
        },
        brand: {
          DEFAULT: "#C6FF3D",
          hover: "#AEE62A",
          light: "#1E2A0E",
        },
        canvas: "#0A0D08",
        surface: "#12160D",
        "surface-hover": "#1A2013",
        line: "#232B1B",
        ink: {
          DEFAULT: "#F3F6EF",
          muted: "#93A08C",
        },
        success: { DEFAULT: "#34D399", light: "#122318" },
        warning: { DEFAULT: "#F2B33D", light: "#2B2210" },
        danger: { DEFAULT: "#F0555A", light: "#2B1414" },
        // Paleta escura só da tela de Mensagens — mantida em roxo/azulado
        // como um "canto" próprio dentro do sistema (agora que o resto
        // também é escuro/verde-limão, o roxo ainda funciona como um
        // diferencial sutil, só que entre dois tons escuros em vez de
        // escuro-contra-claro).
        chat: {
          bg: "#120C22",
          sidebar: "#170F27",
          surface: "#1F1838",
          "surface-hover": "#292048",
          border: "#2C2450",
          active: "#3B2C5E",
          bubble: "#241C42",
          "bubble-mine": "#43308A",
          muted: "#948DB6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      // Sombras recalibradas pro fundo escuro: precisam de mais opacidade
      // de preto puro pra "descolar" o card do fundo (a receita antiga,
      // pensada pra cards brancos sobre fundo claro, ficava invisível aqui).
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.35), 0 1px 1px rgba(0, 0, 0, 0.25)",
        "card-hover": "0 14px 28px rgba(0, 0, 0, 0.45), 0 4px 10px rgba(0, 0, 0, 0.3)",
        dropdown: "0 16px 40px rgba(0, 0, 0, 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
