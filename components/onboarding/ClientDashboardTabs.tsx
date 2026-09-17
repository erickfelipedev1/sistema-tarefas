"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ClipboardListIcon, FileStackIcon, ReceiptIcon } from "../ui/icons";

const ABAS = [
  { key: "andamento", label: "Andamento", icon: ClipboardListIcon },
  { key: "documentos", label: "Documentos", icon: FileStackIcon },
  { key: "faturas", label: "Faturas", icon: ReceiptIcon },
] as const;

type AbaKey = (typeof ABAS)[number]["key"];

// Só troca a aba visível (useState local) — todo o dado já vem pronto do
// servidor (app/progresso/[token]/page.tsx) e é passado como children, sem
// nenhuma busca extra aqui. Mesmo padrão de ProjectTabs.tsx: as três abas
// ficam sempre montadas, só escondidas com CSS.
export function ClientDashboardTabs({
  andamento,
  documentos,
  faturas,
}: {
  andamento: ReactNode;
  documentos: ReactNode;
  faturas: ReactNode;
}) {
  const [aba, setAba] = useState<AbaKey>("andamento");

  return (
    <div className="mt-8">
      <div className="mb-5 flex items-center gap-1 border-b border-line">
        {ABAS.map((item) => {
          const Icon = item.icon;
          const ativa = item.key === aba;
          return (
            <button
              key={item.key}
              onClick={() => setAba(item.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                ativa
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className={aba === "andamento" ? "" : "hidden"}>{andamento}</div>
      <div className={aba === "documentos" ? "" : "hidden"}>{documentos}</div>
      <div className={aba === "faturas" ? "" : "hidden"}>{faturas}</div>
    </div>
  );
}
