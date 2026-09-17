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
        // Paleta "vibe NDL" (nowdigitallab.com.br), agora com tema claro e
        // escuro: os tokens abaixo (exceto navy/chat, que não trocam de
        // tema de propósito) lêem de variáveis CSS definidas em
        // globals.css — trocar o valor da variável (via [data-theme]) já
        // atualiza toda a UI, sem precisar mexer em cada componente.
        // "navy" é o quase-preto fixo, usado como texto escuro sobre o
        // verde (bg-brand text-navy) e como fundo permanente da barra
        // lateral — não muda com o tema.
        navy: {
          DEFAULT: "#12160D",
          light: "#1B2213",
        },
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          hover: "rgb(var(--color-brand-hover) / <alpha-value>)",
          light: "rgb(var(--color-brand-light) / <alpha-value>)",
        },
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--color-surface-hover) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--color-success) / <alpha-value>)",
          light: "rgb(var(--color-success-light) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
          light: "rgb(var(--color-warning-light) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--color-danger) / <alpha-value>)",
          light: "rgb(var(--color-danger-light) / <alpha-value>)",
        },
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
      // Sombras também trocam de tema (mais fortes no escuro, bem mais
      // sutis no claro) — por isso viram variáveis também, em vez de
      // valores fixos.
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        dropdown: "var(--shadow-dropdown)",
      },
    },
  },
  plugins: [],
};

export default config;
