"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpenIcon,
  ClipboardListIcon,
  FileStackIcon,
  MessageCircleIcon,
  ReceiptIcon,
} from "./ui/icons";

const ABAS = [
  { key: "tarefas", label: "Tarefas", icon: ClipboardListIcon },
  { key: "wiki", label: "Wiki", icon: BookOpenIcon },
  { key: "arquivos", label: "Arquivos", icon: FileStackIcon },
  { key: "faturas", label: "Faturas", icon: ReceiptIcon },
  { key: "mensagens", label: "Mensagens", icon: MessageCircleIcon },
] as const;

type AbaKey = (typeof ABAS)[number]["key"];

// As cinco abas ficam sempre montadas (só escondidas com CSS) pra não
// perder o estado nem reconectar o realtime do quadro de tarefas/drive/
// faturas/mensagens toda vez que alguém troca de aba.
export default function ProjectTabs({
  tarefas,
  wiki,
  arquivos,
  faturas,
  mensagens,
}: {
  tarefas: ReactNode;
  wiki: ReactNode;
  arquivos: ReactNode;
  faturas: ReactNode;
  mensagens: ReactNode;
}) {
  const [aba, setAba] = useState<AbaKey>("tarefas");

  return (
    <div>
      <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line">
        {ABAS.map((item) => {
          const Icon = item.icon;
          const ativa = item.key === aba;
          return (
            <button
              key={item.key}
              onClick={() => setAba(item.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
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

      <div className={aba === "tarefas" ? "" : "hidden"}>{tarefas}</div>
      <div className={aba === "wiki" ? "" : "hidden"}>{wiki}</div>
      <div className={aba === "arquivos" ? "" : "hidden"}>{arquivos}</div>
      <div className={aba === "faturas" ? "" : "hidden"}>{faturas}</div>
      <div className={aba === "mensagens" ? "" : "hidden"}>{mensagens}</div>
    </div>
  );
}
