"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "now-organiza-theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

// Script rodado ANTES do React hidratar (ver app/layout.tsx) — lê a
// preferência salva no navegador e já aplica no <html>, pra não ter o
// "flash" de aparecer um tema e trocar pro outro um instante depois.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var salvo = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    document.documentElement.dataset.theme = salvo === "light" ? "light" : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Começa em "dark" (mesmo valor do script inline) — o efeito abaixo só
  // sincroniza o estado do React com o que já está no DOM/localStorage,
  // sem causar flash nem warning de hidratação.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    setTheme(salvo === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage indisponível (ex: modo privado) — não tem problema,
      // só não vai lembrar a escolha na próxima visita.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme precisa ser usado dentro de um ThemeProvider.");
  }
  return ctx;
}
