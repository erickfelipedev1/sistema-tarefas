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
        // escuro: os tokens abaixo (exceto navy, que não troca de
        // tema de propósito) lêem de variáveis CSS definidas em
        // globals.css — trocar o valor da variável (via [data-theme]) já
        // atualiza toda a UI, sem precisar mexer em cada componente.
        // "navy" é o quase-preto fixo, usado como texto escuro sobre o
        // verde (bg-brand text-navy) e como fundo permanente da barra
        // lateral — não muda com o tema.
        avatar: "rgb(var(--color-avatar) / <alpha-value>)",
        navy: {
          DEFAULT: "#12160D",
          light: "#1B2213",
        },
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          hover: "rgb(var(--color-brand-hover) / <alpha-value>)",
          light: "rgb(var(--color-brand-light) / <alpha-value>)",
          forte: "rgb(var(--color-brand-forte) / <alpha-value>)",
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
      // Movimento do sistema — curto e discreto. Nenhuma animação usa
      // "forwards": um transform que sobra no fim prenderia os modais
      // (position: fixed) dentro do elemento animado. Quem pede menos
      // movimento no sistema operacional fica sem (ver globals.css).
      keyframes: {
        // Página, aba, cartão e item de lista entrando.
        entrar: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Fundo escurecido de modal e menu lateral.
        aparecer: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Caixa do modal.
        surgir: {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Menus suspensos (cresce a partir do canto de onde abre).
        pop: {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Menu lateral no celular.
        deslizar: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        // Barras de gráfico e de progresso enchendo.
        crescer: {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
        encher: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        // Medidores em SVG do Painel: o traço se desenha. "--traco" é o
        // comprimento do traço, passado por cada medidor.
        tracar: {
          from: { strokeDashoffset: "var(--traco)" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        entrar: "entrar 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        aparecer: "aparecer 160ms ease-out backwards",
        surgir: "surgir 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        pop: "pop 130ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        deslizar: "deslizar 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        crescer: "crescer 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        encher: "encher 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        tracar: "tracar 700ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
      },
    },
  },
  plugins: [],
};

export default config;
