"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarIcon,
  ClipboardListIcon,
  FileStackIcon,
  HomeIcon,
  ReceiptIcon,
} from "../ui/icons";
import { CLIENT_TAB_SWITCH_EVENT, type ClientPortalTab } from "./client-tab-switch";

const ABAS = [
  { key: "visaoGeral", label: "Visão geral", icon: HomeIcon },
  { key: "andamento", label: "Andamento", icon: ClipboardListIcon },
  { key: "calendario", label: "Calendário", icon: CalendarIcon },
  { key: "documentos", label: "Documentos", icon: FileStackIcon },
  { key: "faturas", label: "Faturas", icon: ReceiptIcon },
] as const satisfies readonly { key: ClientPortalTab; label: string; icon: unknown }[];

// Só troca a aba visível (useState local) — todo o dado já vem pronto do
// servidor (app/progresso/[token]/page.tsx) e é passado como children, sem
// nenhuma busca extra aqui. Mesmo padrão de ProjectTabs.tsx: as abas
// ficam sempre montadas, só escondidas com CSS. Também escuta o evento
// "client-portal:switch-tab" (disparado por botões tipo "Ver todas as
// faturas" dentro da Visão geral) pra trocar de aba por fora.
export function ClientDashboardTabs({
  visaoGeral,
  andamento,
  calendario,
  documentos,
  faturas,
}: {
  visaoGeral: ReactNode;
  andamento: ReactNode;
  calendario: ReactNode;
  documentos: ReactNode;
  faturas: ReactNode;
}) {
  const [aba, setAba] = useState<ClientPortalTab>("visaoGeral");

  useEffect(() => {
    function aoTrocar(e: Event) {
      const detalhe = (e as CustomEvent<ClientPortalTab>).detail;
      if (detalhe) setAba(detalhe);
    }
    window.addEventListener(CLIENT_TAB_SWITCH_EVENT, aoTrocar);
    return () => window.removeEventListener(CLIENT_TAB_SWITCH_EVENT, aoTrocar);
  }, []);

  return (
    <div className="mt-8">
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

      <div className={aba === "visaoGeral" ? "" : "hidden"}>{visaoGeral}</div>
      <div className={aba === "andamento" ? "" : "hidden"}>{andamento}</div>
      <div className={aba === "calendario" ? "" : "hidden"}>{calendario}</div>
      <div className={aba === "documentos" ? "" : "hidden"}>{documentos}</div>
      <div className={aba === "faturas" ? "" : "hidden"}>{faturas}</div>
    </div>
  );
}
