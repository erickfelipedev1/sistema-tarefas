"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mudarOtimizacao } from "@/lib/actions/estrategia-rotina";
import { ROTULO_DO_STATUS_DA_OTIMIZACAO } from "@/lib/estrategia/rotina";
import type { EstOtimizacao } from "@/lib/estrategia/tipos";
import { formatarDataBR } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

type Filtro = "abertos" | "resultado" | "todos";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "abertos", rotulo: "Em aberto" },
  { id: "resultado", rotulo: "Com resultado" },
  { id: "todos", rotulo: "Todos" },
];

const TOM_DO_STATUS = {
  aguardando_aprovacao_cliente: "warning",
  aguardando_aviso: "warning",
  cliente_avisado: "brand",
  resultado_registrado: "success",
} as const;

export default function PainelDeOtimizacao({ mapeamentoId, otimizacoes }: { mapeamentoId: string; otimizacoes: EstOtimizacao[] }) {
  const [filtro, setFiltro] = useState<Filtro>("abertos");

  const visiveis = otimizacoes.filter((o) =>
    filtro === "todos" ? true : filtro === "resultado" ? o.status === "resultado_registrado" : o.status !== "resultado_registrado"
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Painel de Otimização</h2>
        <p className="text-xs text-ink-muted">Cada ajuste do ciclo, do sinal ao resultado. Alimenta as melhorias feitas da reunião mensal.</p>
        <div role="group" aria-label="Filtrar ajustes" className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filtro === f.id ? "primary" : "secondary"}
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
            >
              {f.rotulo}
            </Button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
          {otimizacoes.length === 0 ? "Nenhum ajuste ainda. Os ajustes aceitos na aba Semana aparecem aqui." : "Nenhum ajuste neste filtro."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((o) => (
            <li key={o.id}>
              <CartaoDaOtimizacao o={o} mapeamentoId={mapeamentoId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoDaOtimizacao({ o, mapeamentoId }: { o: EstOtimizacao; mapeamentoId: string }) {
  const router = useRouter();
  const [resultado, setResultado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = `otimizacao-${o.id}`;

  async function mudar(para: "cliente_avisado" | "resultado_registrado", texto?: string) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await mudarOtimizacao({ id: o.id, mapeamentoId, para, resultado: texto });
      if ("erro" in r) return setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não deu pra atualizar o ajuste agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  const fatos: [string, string][] = [
    ["Sinal", o.sinal],
    ["Hipótese", o.hipotese],
    ["Ajuste", o.ajuste],
    ["Indicador", o.indicador],
    ["Decisão", o.justificativa],
    ["Resultado", o.resultado],
  ];

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink">{o.titulo}</p>
        <Badge tone={TOM_DO_STATUS[o.status] ?? "neutral"}>{ROTULO_DO_STATUS_DA_OTIMIZACAO[o.status] ?? o.status}</Badge>
        {o.muda_peca_aprovada && <Badge tone="warning">Muda peça aprovada</Badge>}
      </div>
      <p className="text-xs text-ink-muted">Semana de {formatarDataBR(o.semana).slice(0, 5)}</p>
      <dl className="space-y-1 text-sm">
        {fatos.map(([rotulo, valor]) =>
          valor ? (
            <div key={rotulo} className="whitespace-pre-wrap break-words">
              <dt className="inline text-xs font-semibold text-ink-muted">{rotulo}: </dt>
              <dd className="inline text-ink">{valor}</dd>
            </div>
          ) : null
        )}
      </dl>

      {o.status === "aguardando_aviso" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => mudar("cliente_avisado")} disabled={ocupado}>
            Marcar cliente avisado
          </Button>
        </div>
      )}
      {o.status === "aguardando_aprovacao_cliente" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => mudar("cliente_avisado")} disabled={ocupado}>
            Cliente aprovou
          </Button>
          <Button size="sm" variant="secondary" onClick={() => mudar("resultado_registrado", "Cliente não aprovou o ajuste.")} disabled={ocupado}>
            Cliente não aprovou
          </Button>
        </div>
      )}
      {o.status === "cliente_avisado" && (
        <div className="space-y-2 pt-1">
          <div>
            <label htmlFor={`${id}-resultado`} className="mb-1 block text-xs font-medium text-ink-muted">
              Resultado observado no indicador
            </label>
            <input
              id={`${id}-resultado`}
              type="text"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              disabled={ocupado}
              maxLength={2000}
              className={campoClasse}
            />
          </div>
          <Button size="sm" onClick={() => mudar("resultado_registrado", resultado)} disabled={ocupado || resultado.trim() === ""}>
            Registrar resultado
          </Button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
