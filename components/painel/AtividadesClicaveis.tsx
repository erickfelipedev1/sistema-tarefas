"use client";

import { useState } from "react";
import Link from "next/link";
import { Anel } from "./Medidores";
import type { AtividadesDoPainel, TarefaMetrica } from "@/lib/painel";

type Chave = "atrasadas" | "abertas" | "realizadas";

const STATUS: Record<string, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  dependency: "Dependência",
  approval: "Em aprovação",
  done: "Concluída",
};

const TITULOS: Record<Chave, string> = {
  atrasadas: "Atrasadas",
  abertas: "Abertas",
  realizadas: "Realizadas",
};

function dia(iso: string | null) {
  if (!iso) return "";
  const [ano, mes, d] = iso.slice(0, 10).split("-");
  return `${d}/${mes}/${ano}`;
}

// Os três anéis do topo do Painel e a lista "Atividades", clicáveis: tocar num
// deles abre, logo abaixo, as tarefas que formam aquele número (outro toque no
// mesmo fecha). Devolve as duas células da grade do topo + a faixa da lista.
export default function AtividadesClicaveis({
  atividades,
  cores,
  partes,
  total,
  nomesProjetos,
}: {
  atividades: AtividadesDoPainel;
  cores: Record<Chave, string>;
  partes: Record<Chave, number | null>;
  total: number;
  nomesProjetos: Record<string, string>;
}) {
  const [aberto, setAberto] = useState<Chave | null>(null);
  const alternar = (c: Chave) => setAberto((atual) => (atual === c ? null : c));
  const nomeDe = (id: string | null) => (id ? nomesProjetos[id] ?? "Cliente" : "Geral");
  const lista: TarefaMetrica[] = aberto ? atividades[aberto] : [];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 lg:px-6">
        {(["atrasadas", "abertas", "realizadas"] as Chave[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => alternar(c)}
            aria-expanded={aberto === c}
            title={`Ver as tarefas: ${TITULOS[c].toLowerCase()}`}
            className={`rounded-xl p-1 transition-colors hover:bg-surface-hover ${aberto === c ? "bg-surface-hover" : ""}`}
          >
            <Anel rotulo={TITULOS[c]} cor={cores[c]} quantidade={atividades[c].length} valor={partes[c]} />
          </button>
        ))}
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm lg:pl-6">
        <dt className="col-span-2 mb-1 text-sm font-semibold text-ink">Atividades</dt>
        {(["atrasadas", "realizadas", "abertas"] as Chave[]).map((c) => (
          <div key={c} className="contents">
            <dt>
              <button type="button" onClick={() => alternar(c)} className="text-ink-muted hover:text-ink hover:underline">
                {TITULOS[c]}
              </button>
            </dt>
            <dd className="text-right font-semibold text-ink">{atividades[c].length}</dd>
          </div>
        ))}
        <dt className="border-t border-line pt-1 text-ink-muted">Total</dt>
        <dd className="border-t border-line pt-1 text-right font-semibold text-ink">{total}</dd>
      </dl>

      {aberto && (
        <div className="col-span-full mt-5 border-t border-line pt-4 lg:!border-l-0">
          <p className="text-sm font-semibold text-ink">
            {TITULOS[aberto]} <span className="font-normal text-ink-muted">({lista.length})</span>
          </p>
          {lista.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nenhuma tarefa aqui.</p>
          ) : (
            <ul className="mt-2 grid max-h-96 gap-x-6 divide-y divide-line overflow-y-auto lg:grid-cols-2 lg:divide-y-0">
              {lista.map((t) => (
                <li key={t.id} className="border-b border-line last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <Link
                    href={t.project_id ? `/projetos/${t.project_id}` : "/board"}
                    className="flex items-center justify-between gap-3 py-2 hover:text-brand-forte"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{t.title}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {nomeDe(t.project_id)} · {STATUS[t.status] ?? t.status}
                      </span>
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs font-medium ${aberto === "atrasadas" ? "text-danger" : "text-ink-muted"}`}
                    >
                      {aberto === "realizadas" ? dia(t.completed_at) : dia(t.due_date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
