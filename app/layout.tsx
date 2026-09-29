import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Fonte só do nome no logo (components/ui/Logo.tsx).
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-logo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NowHub",
  description: "Central de tarefas, clientes e demandas.",
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // translate="no": o sistema já é em português, e o tradutor automático
    // do Chrome estragava abreviações (ex: "DOM/QUA/SEX" do calendário
    // virando "CASA/TAMBÉM/SEXO").
    <html
      lang="pt-BR"
      translate="no"
      className={`${inter.variable} ${outfit.variable}`}
      data-theme="dark"
    >
      <head>
        {/* Aplica o tema salvo antes do React hidratar, pra não piscar o
            tema errado por uma fração de segundo. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
