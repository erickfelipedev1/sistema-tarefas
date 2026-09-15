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
        navy: {
          DEFAULT: "#10182F",
          light: "#1B2547",
        },
        brand: {
          DEFAULT: "#3157D5",
          hover: "#2646c2",
          light: "#EEF2FD",
        },
        canvas: "#F6F8FC",
        line: "#E5E9F2",
        ink: {
          DEFAULT: "#172033",
          muted: "#718096",
        },
        success: { DEFAULT: "#20A464", light: "#E7F7EE" },
        warning: { DEFAULT: "#E5A11A", light: "#FDF3E0" },
        danger: { DEFAULT: "#D94A4A", light: "#FBEAEA" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 47, 0.05), 0 1px 1px rgba(16, 24, 47, 0.04)",
        "card-hover":
          "0 10px 24px rgba(16, 24, 47, 0.10), 0 2px 6px rgba(16, 24, 47, 0.06)",
        dropdown: "0 12px 32px rgba(16, 24, 47, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
