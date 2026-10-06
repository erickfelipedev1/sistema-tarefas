import type { Metadata, Viewport } from "next";
import { Nunito, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import PwaSetup from "@/components/PwaSetup";

// Fonte do sistema: Nunito, de cantos arredondados (antes era a Inter).
const texto = Nunito({
  subsets: ["latin"],
  variable: "--font-texto",
  display: "swap",
});

// Fonte só do logo "d.hub" (components/ui/Logo.tsx): "d" negrito, ".hub" fino.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "700"],
  variable: "--font-logo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "d.hub",
  description: "Central de tarefas, clientes e demandas.",
  other: { google: "notranslate" },
  // iPhone: abre em tela cheia quando instalado na tela de início.
  appleWebApp: { capable: true, title: "d.hub", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0A0D08",
  width: "device-width",
  initialScale: 1,
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
      className={`${texto.variable} ${outfit.variable}`}
      data-theme="dark"
    >
      <head>
        {/* Aplica o tema salvo antes do React hidratar, pra não piscar o
            tema errado por uma fração de segundo. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <PwaSetup />
      </body>
    </html>
  );
}
