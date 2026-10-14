"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataBR } from "@/lib/format";
import type { Optimization } from "@/lib/types";
import { SlidersIcon } from "../ui/icons";
import { TituloDoBloco } from "./pecas";

// O que o portal recebe de cada otimização (só o que aparece na tela).
export type OtimizacaoPublica = Pick<
  Optimization,
  "id" | "opt_date" | "place" | "action_taken" | "justification" | "created_by_label"
>;

const RECENTES = 5;

// "Otimizações" no fim da aba Analytics: o que o tráfego otimizou nas
// campanhas do cliente (data, onde, o que foi feito e por quê), da mais nova
// pra mais antiga. Na equipe lê direto da tabela (quem registra e edita
// continua na aba "Otimizações"); no portal as otimizações já vêm prontas do
// servidor (migration 0072).
export default function OtimizacoesNoAnalytics(
  props: { modo: "equipe"; projectId: string } | { modo: "portal"; otimizacoes: OtimizacaoPublica[] }
) {
  return props.modo === "portal" ? (
    <Bloco otimizacoes={props.otimizacoes} />
  ) : (
    <DaEquipe projectId={props.projectId} />
  );
}

function DaEquipe({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [itens, setItens] = useState<OtimizacaoPublica[] | null>(null);

  useEffect(() => {
    let ativo = true;
    setItens(null);
    supabase
      .from("optimizations")
      .select("*")
      .eq("project_id", projectId)
      .order("opt_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (ativo) setItens(error ? [] : ((data ?? []) as OtimizacaoPublica[]));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!itens) return null;
  return <Bloco otimizacoes={itens} />;
}

function Bloco({ otimizacoes }: { otimizacoes: OtimizacaoPublica[] }) {
  const [abertas, setAbertas] = useState(false);
  if (otimizacoes.length === 0) return null;
  const recentes = otimizacoes.slice(0, RECENTES);
  const anteriores = otimizacoes.slice(RECENTES);
  return (
    <section className="cartao-analytics mt-4 p-5">
      <TituloDoBloco
        icone={<SlidersIcon className="h-4 w-4" />}
        titulo="Otimizações"
        apoio="O que a equipe ajustou nas suas campanhas"
      />
      <ul className="mt-4 space-y-4">
        {recentes.map((o) => (
          <Item key={o.id} otimizacao={o} />
        ))}
      </ul>
      {anteriores.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setAbertas((a) => !a)}
            aria-expanded={abertas}
            className="text-xs font-medium text-brand-forte hover:underline"
          >
            {abertas ? "Esconder as anteriores" : `Ver as anteriores (${anteriores.length})`}
          </button>
          {abertas && (
            <ul className="mt-3 space-y-4">
              {anteriores.map((o) => (
                <Item key={o.id} otimizacao={o} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Item({ otimizacao }: { otimizacao: OtimizacaoPublica }) {
  return (
    <li>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="font-semibold tabular-nums text-ink">{formatarDataBR(otimizacao.opt_date)}</span>
        <span className="rounded-full border border-line bg-canvas px-2 py-0.5 font-medium text-ink">{otimizacao.place}</span>
        {otimizacao.created_by_label && <span>por {otimizacao.created_by_label}</span>}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{otimizacao.action_taken}</p>
      {otimizacao.justification && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Por quê: </span>
          {otimizacao.justification}
        </p>
      )}
    </li>
  );
}
