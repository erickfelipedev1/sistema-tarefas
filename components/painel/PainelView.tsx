import Link from "next/link";
import type { ItemCaixaDeEntrada, Painel, TarefaMetrica } from "@/lib/painel";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import PainelFiltros from "./PainelFiltros";
import GraficoSemanas from "./GraficoSemanas";

// Parte visual do Painel — recebe tudo já calculado (ver
// app/(app)/painel/page.tsx), sem buscar nada.
export default function PainelView({
  painel,
  caixaDeEntrada,
  periodoChave,
  periodos,
  rotuloPeriodo,
  semanas,
  pessoas,
  pessoaAtual,
  subtitulo,
  semMigracao,
  totalHoras,
  nomesProjetos,
}: {
  painel: Painel;
  caixaDeEntrada: ItemCaixaDeEntrada[];
  periodoChave: string;
  periodos: { valor: string; rotulo: string }[];
  rotuloPeriodo: string;
  semanas: number;
  pessoas: { id: string; nome: string }[] | null;
  pessoaAtual: string;
  subtitulo: string;
  semMigracao: boolean;
  totalHoras: number;
  nomesProjetos: Record<string, string>;
}) {
  const nomeDe = (id: string | null) => (id ? nomesProjetos[id] ?? "Cliente" : "Geral");
  const maiorCliente = Math.max(1, ...painel.porCliente.map((c) => c.total));
  const variacao = painel.concluidas - painel.concluidasAnterior;

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <PageHeader title="Painel" subtitle={subtitulo} />

      <PainelFiltros
        periodoAtual={periodoChave}
        periodos={periodos}
        pessoas={pessoas}
        pessoaAtual={pessoaAtual}
      />

      {semMigracao && (
        <p className="mb-5 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
          Falta rodar a migration 0033_task_completed_at.sql no Supabase — sem ela o painel não sabe
          quando cada tarefa foi concluída.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 col-span-2 lg:row-span-2">
          <p className="text-xs font-medium text-ink-muted">Entregas no prazo</p>
          {painel.taxaNoPrazo === null ? (
            <>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-ink">—</p>
              <p className="mt-2 text-sm text-ink-muted">
                Nenhuma tarefa com prazo concluída nos últimos {rotuloPeriodo}.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-ink">
                {Math.round(painel.taxaNoPrazo * 100)}%
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {painel.noPrazo} de {painel.comPrazo}{" "}
                {painel.comPrazo === 1 ? "tarefa com prazo foi entregue" : "tarefas com prazo foram entregues"}{" "}
                até a data combinada.
              </p>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-surface-hover lg:mt-auto"
                role="img"
                aria-label={`${Math.round(painel.taxaNoPrazo * 100)}% no prazo`}
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${painel.taxaNoPrazo * 100}%` }}
                />
              </div>
            </>
          )}
        </div>

        <Tile
          rotulo="Concluídas"
          valor={String(painel.concluidas)}
          detalhe={
            variacao === 0
              ? "igual ao período anterior"
              : `${variacao > 0 ? "▲" : "▼"} ${Math.abs(variacao)} vs período anterior`
          }
        />
        <Tile
          rotulo="Tempo médio de entrega"
          valor={formatarDuracao(painel.tempoMedioDias)}
          detalhe="da criação à conclusão"
        />
        <Tile
          rotulo="Em aberto"
          valor={String(painel.abertas)}
          detalhe={`${painel.emAndamento} em andamento`}
        />
        <Tile
          rotulo="Atrasadas"
          valor={String(painel.atrasadas.length)}
          detalhe={painel.atrasadas.length ? "prazo já passou" : "nada atrasado"}
          alerta={painel.atrasadas.length > 0}
        />
      </section>

      <CaixaDeEntrada itens={caixaDeEntrada} nomeDe={nomeDe} />

      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-ink">Concluídas por semana</p>
          <p className="mt-0.5 text-xs text-ink-muted">Últimas {semanas} semanas</p>
          <GraficoSemanas dados={painel.porSemana} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-ink">Por cliente</p>
          <p className="mt-0.5 text-xs text-ink-muted">Concluídas nos últimos {rotuloPeriodo}</p>
          {painel.porCliente.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Nada concluído no período.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {painel.porCliente.slice(0, 6).map((c) => (
                <li key={c.projectId ?? "geral"}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-ink">{nomeDe(c.projectId)}</span>
                    <span className="font-medium text-ink">{c.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(c.total / maiorCliente) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 border-t border-line pt-3 text-xs text-ink-muted">
            <span className="font-medium text-ink">
              {totalHoras.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
            </span>{" "}
            registradas no período
          </p>
        </div>
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <ListaTarefas
          titulo="Atrasadas"
          vazio="Nenhuma tarefa atrasada."
          tarefas={painel.atrasadas}
          nomeDe={nomeDe}
          alerta
        />
        <ListaTarefas
          titulo="Vencem nos próximos 7 dias"
          vazio="Nada vencendo nesta semana."
          tarefas={painel.vencendo}
          nomeDe={nomeDe}
        />
      </section>

      {painel.semDataDeConclusao > 0 && !semMigracao && (
        <p className="mt-4 text-xs text-ink-muted">
          {painel.semDataDeConclusao}{" "}
          {painel.semDataDeConclusao === 1 ? "tarefa concluída" : "tarefas concluídas"} antes do
          painel existir não {painel.semDataDeConclusao === 1 ? "tem" : "têm"} data de conclusão e
          fica{painel.semDataDeConclusao === 1 ? "" : "m"} fora das métricas de prazo e tempo.
        </p>
      )}
    </main>
  );
}

function formatarDuracao(dias: number | null) {
  if (dias === null) return "—";
  if (dias < 1) return `${Math.max(1, Math.round(dias * 24))} h`;
  return `${dias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${dias < 1.05 ? "dia" : "dias"}`;
}

function formatarPrazo(dia: string) {
  const [ano, mes, d] = dia.split("-");
  return `${d}/${mes}/${ano}`;
}

function Tile({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${alerta ? "text-danger" : "text-ink"}`}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{detalhe}</p>
    </div>
  );
}

function ListaTarefas({
  titulo,
  vazio,
  tarefas,
  nomeDe,
  alerta,
}: {
  titulo: string;
  vazio: string;
  tarefas: TarefaMetrica[];
  nomeDe: (id: string | null) => string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">
        {titulo} <span className="font-normal text-ink-muted">({tarefas.length})</span>
      </p>
      {tarefas.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{vazio}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {tarefas.slice(0, 8).map((t) => (
            <li key={t.id}>
              <Link
                href={t.project_id ? `/projetos/${t.project_id}` : "/board"}
                className="flex items-center justify-between gap-3 py-2 hover:text-brand"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{t.title}</span>
                  <span className="block text-xs text-ink-muted">{nomeDe(t.project_id)}</span>
                </span>
                <span
                  className={`flex-shrink-0 text-xs font-medium ${alerta ? "text-danger" : "text-ink-muted"}`}
                >
                  {formatarPrazo(t.due_date!)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tarefas.length > 8 && (
        <p className="mt-2 text-xs text-ink-muted">e mais {tarefas.length - 8}.</p>
      )}
    </div>
  );
}

const TOM_URGENCIA: Record<string, "neutral" | "brand" | "warning" | "danger"> = {
  Baixa: "neutral",
  Média: "brand",
  Alta: "warning",
  Urgente: "danger",
};

function descreverOrigem(item: ItemCaixaDeEntrada) {
  const quem = item.deQuem ?? "alguém";
  if (item.origem === "cliente") return `Pedido do cliente · ${quem.replace(/ \(cliente\)$/, "")}`;
  if (item.origem === "solicitacao") return `Solicitação de ${quem}`;
  return `Atribuída por ${quem}`;
}

const MAX_CAIXA = 8;

function CaixaDeEntrada({
  itens,
  nomeDe,
}: {
  itens: ItemCaixaDeEntrada[];
  nomeDe: (id: string | null) => string;
}) {
  const novas = itens.filter((i) => i.nova).length;
  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          Caixa de entrada <span className="font-normal text-ink-muted">({itens.length})</span>
        </p>
        <Link href="/solicitacoes" className="text-xs font-medium text-brand hover:underline">
          Ver solicitações →
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        Tarefas e demandas que chegaram pra você e ainda não foram iniciadas
        {novas > 0 && ` · ${novas} nova${novas === 1 ? "" : "s"}`}
      </p>

      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nada esperando por você. 🎉</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {itens.slice(0, MAX_CAIXA).map((item) => {
            const t = item.tarefa;
            return (
              <li key={t.id}>
                <Link
                  href={t.project_id ? `/projetos/${t.project_id}` : "/board"}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:text-brand"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {item.nova && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand" aria-hidden="true" />
                      )}
                      <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {descreverOrigem(item)} · {nomeDe(t.project_id)}
                      {item.tipo && ` · ${item.tipo}`}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1.5">
                    {item.nova && <Badge tone="brand">Nova</Badge>}
                    {item.urgencia && (
                      <Badge tone={TOM_URGENCIA[item.urgencia] ?? "neutral"}>{item.urgencia}</Badge>
                    )}
                    {t.due_date && (
                      <span className="text-xs text-ink-muted">até {formatarPrazo(t.due_date)}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {itens.length > MAX_CAIXA && (
        <p className="mt-2 text-xs text-ink-muted">e mais {itens.length - MAX_CAIXA}.</p>
      )}
    </section>
  );
}
