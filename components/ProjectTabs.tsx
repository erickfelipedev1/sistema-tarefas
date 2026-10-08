"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  BarChartIcon,
  BookOpenIcon,
  ClipboardListIcon,
  FileStackIcon,
  MessageCircleIcon,
  ReceiptIcon,
  SlidersIcon,
} from "./ui/icons";

const ABAS = [
  { key: "tarefas", label: "Tarefas", icon: ClipboardListIcon },
  { key: "otimizacoes", label: "Otimizações", icon: SlidersIcon },
  { key: "wiki", label: "Wiki", icon: BookOpenIcon },
  { key: "arquivos", label: "Arquivos", icon: FileStackIcon },
  { key: "faturas", label: "Faturas", icon: ReceiptIcon },
  { key: "mensagens", label: "Mensagens", icon: MessageCircleIcon },
  { key: "analytics", label: "Analytics", icon: BarChartIcon },
] as const;

type AbaKey = (typeof ABAS)[number]["key"];

// As abas ficam sempre montadas (só escondidas com CSS) pra não
// perder o estado nem reconectar o realtime do quadro de tarefas/drive/
// faturas/mensagens toda vez que alguém troca de aba.
// "Otimizações" só existe pra quem a página mandar (tráfego e líderes).
// "Analytics" é a exceção: só é montada na primeira vez que alguém abre a
// aba, porque ela consulta o Reportei e não faz sentido toda visita à página
// do cliente pagar essa espera.
export default function ProjectTabs({
  tarefas,
  otimizacoes,
  wiki,
  arquivos,
  faturas,
  mensagens,
  analytics,
}: {
  tarefas: ReactNode;
  otimizacoes?: ReactNode;
  wiki: ReactNode;
  arquivos: ReactNode;
  faturas: ReactNode;
  mensagens: ReactNode;
  analytics: ReactNode;
}) {
  const [aba, setAba] = useState<AbaKey>("tarefas");
  const [abriuAnalytics, setAbriuAnalytics] = useState(false);
  const abas = ABAS.filter((item) => item.key !== "otimizacoes" || !!otimizacoes);

  return (
    <div>
      <div data-mov="card" className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line">
        {abas.map((item) => {
          const Icon = item.icon;
          const ativa = item.key === aba;
          return (
            <button
              key={item.key}
              onClick={() => {
                setAba(item.key);
                if (item.key === "analytics") setAbriuAnalytics(true);
              }}
              className={`flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                ativa
                  ? "border-brand text-brand-forte"
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
      {otimizacoes && (
        <div className={aba === "otimizacoes" ? "" : "hidden"}>{otimizacoes}</div>
      )}
      <div className={aba === "wiki" ? "" : "hidden"}>{wiki}</div>
      <div className={aba === "arquivos" ? "" : "hidden"}>{arquivos}</div>
      <div className={aba === "faturas" ? "" : "hidden"}>{faturas}</div>
      <div className={aba === "mensagens" ? "" : "hidden"}>{mensagens}</div>
      {abriuAnalytics && <div className={aba === "analytics" ? "" : "hidden"}>{analytics}</div>}
    </div>
  );
}
