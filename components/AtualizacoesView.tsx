"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ATUALIZACOES, CHAVE_VISTO, ULTIMA_ATUALIZACAO, type AreaDaAtualizacao } from "@/lib/atualizacoes";
import PedidosDhub from "./PedidosDhub";

const AREAS: AreaDaAtualizacao[] = ["Tarefas", "Posts", "Clientes", "Atas", "Mensagens", "Calendário", "Sistema"];

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloDoDia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  return `${DIAS[data.getDay()]}, ${d} de ${MESES[m - 1]}`;
}

// Tela "Atualizações": o que mudou no d.hub, por dia, com filtro por área.
// O que é novo desde a última visita ganha o selo "Novo". A aba "Pedidos" é
// onde a equipe pede alterações (migration 0088).
export default function AtualizacoesView({
  abaInicial,
  pedidos,
}: {
  abaInicial?: "novidades" | "pedidos";
  pedidos: React.ComponentProps<typeof PedidosDhub>;
}) {
  const [aba, setAba] = useState<"novidades" | "pedidos">(abaInicial ?? "novidades");
  const [area, setArea] = useState<AreaDaAtualizacao | "">("");
  const [vistoAte, setVistoAte] = useState<string | null>(null);
  // A lista só cresce: mostra os dias mais recentes e o resto vem sob demanda.
  const [diasVisiveis, setDiasVisiveis] = useState(10);

  // Lê uma vez só o que já tinha sido visto e marca tudo como visto.
  const lido = useRef<string | null>(null);
  useEffect(() => {
    if (lido.current === null) {
      lido.current = "";
      try {
        lido.current = window.localStorage.getItem(CHAVE_VISTO) ?? "";
        window.localStorage.setItem(CHAVE_VISTO, ULTIMA_ATUALIZACAO);
        window.dispatchEvent(new Event("dhub-atualizacoes-vistas"));
      } catch {
        // Sem acesso ao armazenamento do navegador: só não marca o que é novo.
      }
    }
    setVistoAte(lido.current);
  }, []);

  const porDia = useMemo(() => {
    const lista = ATUALIZACOES.filter((a) => !area || a.area === area);
    const grupos: { data: string; itens: typeof lista }[] = [];
    for (const a of lista) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.data === a.data) ultimo.itens.push(a);
      else grupos.push({ data: a.data, itens: [a] });
    }
    return grupos;
  }, [area]);

  const abas = (
    <div data-mov="topo" className="mb-5 inline-flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="Atualizações">
      {(
        [
          ["novidades", "Novidades"],
          ["pedidos", "Pedidos de alteração"],
        ] as const
      ).map(([valor, rotulo]) => (
        <button
          key={valor}
          type="button"
          role="tab"
          aria-selected={aba === valor}
          onClick={() => setAba(valor)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            aba === valor ? "bg-brand text-navy" : "text-ink-muted hover:text-ink"
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );

  if (aba === "pedidos") {
    return (
      <div>
        {abas}
        <PedidosDhub {...pedidos} />
      </div>
    );
  }

  return (
    <div>
      {abas}
      <div data-mov="topo" className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por área">
        {(["", ...AREAS] as const).map((a) => (
          <button
            key={a || "todas"}
            type="button"
            aria-pressed={area === a}
            onClick={() => setArea(a)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              area === a ? "border-brand bg-brand text-navy" : "border-line bg-surface text-ink-muted hover:text-ink"
            }`}
          >
            {a || "Tudo"}
          </button>
        ))}
      </div>

      <ol className="relative space-y-7 border-l border-line pl-5 sm:pl-7">
        {porDia.slice(0, diasVisiveis).map((grupo) => {
          const novo = vistoAte !== null && grupo.data > vistoAte;
          return (
            <li key={grupo.data} data-mov="card" className="relative">
              <span
                className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-canvas sm:-left-[34px] ${novo ? "bg-brand" : "bg-line"}`}
                aria-hidden="true"
              />
              <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {rotuloDoDia(grupo.data)}
                {novo && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-navy">Novo</span>}
              </h2>
              <div className="space-y-2.5">
                {grupo.itens.map((a) => (
                  <article key={a.titulo} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{a.titulo}</h3>
                      <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-ink-muted">{a.area}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{a.texto}</p>
                  </article>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {porDia.length > diasVisiveis && (
        <button
          type="button"
          onClick={() => setDiasVisiveis((n) => n + 10)}
          className="mt-6 w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-brand hover:text-ink"
        >
          Ver atualizações mais antigas
        </button>
      )}
    </div>
  );
}
