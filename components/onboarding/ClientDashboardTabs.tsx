"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChartIcon,
  CalendarIcon,
  ClipboardListIcon,
  FileStackIcon,
  HomeIcon,
  ImageIcon,
  ReceiptIcon,
} from "../ui/icons";
import { CLIENT_TAB_SWITCH_EVENT, type ClientPortalTab } from "./client-tab-switch";

const ABAS = [
  { key: "visaoGeral", label: "Visão geral", icon: HomeIcon },
  { key: "andamento", label: "Andamento", icon: ClipboardListIcon },
  { key: "calendario", label: "Calendário", icon: CalendarIcon },
  { key: "posts", label: "Posts", icon: ImageIcon },
  { key: "analytics", label: "Analytics", icon: BarChartIcon },
  { key: "documentos", label: "Documentos", icon: FileStackIcon },
  { key: "faturas", label: "Faturas", icon: ReceiptIcon },
] as const satisfies readonly { key: ClientPortalTab; label: string; icon: unknown }[];

// Só troca a aba visível (useState local) — todo o dado já vem pronto do
// servidor (app/progresso/[token]/page.tsx) e é passado como children, sem
// nenhuma busca extra aqui. Mesmo padrão de ProjectTabs.tsx: as abas
// ficam sempre montadas, só escondidas com CSS. Também escuta o evento
// "client-portal:switch-tab" (disparado por botões tipo "Ver todas as
// faturas" dentro da Visão geral) pra trocar de aba por fora.
// "Analytics" é a exceção: só existe quando a página manda (projeto ligado
// aos números) e só é montada na primeira vez que o cliente abre a aba,
// porque ela busca os dados na hora.
export function ClientDashboardTabs({
  visaoGeral,
  andamento,
  calendario,
  posts,
  postsEsperando = 0,
  analytics,
  documentos,
  faturas,
}: {
  visaoGeral: ReactNode;
  andamento: ReactNode;
  calendario: ReactNode;
  posts: ReactNode;
  // Quantos posts esperam o comentário do cliente (vira o número na aba).
  postsEsperando?: number;
  analytics?: ReactNode;
  documentos: ReactNode;
  faturas: ReactNode;
}) {
  const [abaPedida, setAba] = useState<ClientPortalTab>("visaoGeral");
  const [abriuAnalytics, setAbriuAnalytics] = useState(false);
  const abas = ABAS.filter((item) => item.key !== "analytics" || !!analytics);
  // Pedido de fora pra uma aba que este cliente não tem cai na Visão geral.
  const aba: ClientPortalTab = abas.some((item) => item.key === abaPedida) ? abaPedida : "visaoGeral";

  // Qualquer caminho que leve à aba (clique ou evento de fora) monta a tela.
  useEffect(() => {
    if (aba === "analytics") setAbriuAnalytics(true);
  }, [aba]);

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
        {abas.map((item) => {
          const Icon = item.icon;
          const ativa = item.key === aba;
          return (
            <button
              key={item.key}
              onClick={() => setAba(item.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                ativa
                  ? "border-brand text-brand-forte"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.key === "posts" && postsEsperando > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold tabular-nums text-navy">
                  {postsEsperando}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={aba === "visaoGeral" ? "" : "hidden"}>{visaoGeral}</div>
      <div className={aba === "andamento" ? "" : "hidden"}>{andamento}</div>
      <div className={aba === "calendario" ? "" : "hidden"}>{calendario}</div>
      <div className={aba === "posts" ? "" : "hidden"}>{posts}</div>
      {analytics && abriuAnalytics && <div className={aba === "analytics" ? "" : "hidden"}>{analytics}</div>}
      <div className={aba === "documentos" ? "" : "hidden"}>{documentos}</div>
      <div className={aba === "faturas" ? "" : "hidden"}>{faturas}</div>
    </div>
  );
}
