import Link from "next/link";
import { diaSP } from "@/lib/painel";
import type { Optimization } from "@/lib/types";
import type {
  BlocoEficiencia,
  Eficiencia,
  ItemCaixaDeEntrada,
  Painel,
  PostComAjuste,
  TarefaMetrica,
} from "@/lib/painel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import Coreografia from "@/components/movimento/Coreografia";
import PainelFiltros from "./PainelFiltros";
import GraficoSemanas from "./GraficoSemanas";
import { AneisConcentricos, Anel, MeiaLua } from "./Medidores";

// Otimização do tráfego como o Painel mostra (ver app/(app)/painel/page.tsx).
export type OtimizacaoDoPainel = Pick<
  Optimization,
  "id" | "project_id" | "opt_date" | "place" | "action_taken" | "justification"
>;

// Parte visual do Painel — recebe tudo já calculado (ver
// app/(app)/painel/page.tsx), sem buscar nada. A entrada animada é da
// Coreografia: aqui os elementos só se marcam com data-mov (ver
// components/movimento/Coreografia.tsx).
export default function PainelView({
  painel,
  eficiencia,
  pessoaNome,
  pessoaAvatar,
  pessoaCargo,
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
  otimizacoes = null,
  lembreteLixo = null,
  postsComAjuste = [],
}: {
  painel: Painel;
  eficiencia: Eficiencia;
  pessoaNome: string;
  pessoaAvatar: string | null;
  pessoaCargo: string | null;
  caixaDeEntrada: ItemCaixaDeEntrada[];
  postsComAjuste?: PostComAjuste[];
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
  // Otimizações que a pessoa registrou no período; null = não é do tráfego,
  // o cartão nem aparece.
  otimizacoes?: OtimizacaoDoPainel[] | null;
  // Se a pessoa está na escala do lixo hoje (lib/regras.ts).
  lembreteLixo?: { rotulo: string; colegas: string[] } | null;
}) {
  const nomeDe = (id: string | null) => (id ? nomesProjetos[id] ?? "Cliente" : "Geral");
  const maiorCliente = Math.max(1, ...painel.porCliente.map((c) => c.total));
  const variacao = painel.concluidas - painel.concluidasAnterior;

  return (
    // key: trocar o período ou a pessoa remonta e a entrada toca de novo.
    <Coreografia key={`${periodoChave}-${pessoaAtual}`}>
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Painel" subtitle={subtitulo} />

      <div data-mov="topo">
        <PainelFiltros
          periodoAtual={periodoChave}
          periodos={periodos}
          pessoas={pessoas}
          pessoaAtual={pessoaAtual}
        />
      </div>

      {semMigracao && (
        <p className="mb-5 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
          Falta rodar a migration 0033_task_completed_at.sql no Supabase — sem ela o painel não sabe
          quando cada tarefa foi concluída.
        </p>
      )}

      {lembreteLixo && (
        <Link
          href="/regras"
          data-mov="card"
          className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand-forte/40 bg-brand-light px-5 py-3 text-sm hover:border-brand-forte"
        >
          <span aria-hidden="true">🗑️</span>
          <span className="font-semibold text-ink">
            Hoje ({lembreteLixo.rotulo.toLowerCase()}) é seu dia de verificar o lixo, às 12h e às 18h
          </span>
          {lembreteLixo.colegas.length > 0 && (
            <span className="text-ink-muted">com {juntarNomes(lembreteLixo.colegas)}</span>
          )}
          <span className="ml-auto text-xs font-medium text-brand-forte">Ver regras →</span>
        </Link>
      )}

      {/* Faixa do topo: quem é, eficiência geral e a divisão das atividades */}
      <section data-mov="card" className="grid items-center gap-6 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-0 lg:divide-x lg:divide-line">
        <div className="flex items-center gap-4 lg:pr-6">
          <Avatar name={pessoaNome} src={pessoaAvatar} size="md" className="!h-16 !w-16 !text-xl" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{pessoaNome}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{pessoaCargo || "Tarefas, demandas e entregas."}</p>
            <p className="text-sm font-medium text-brand-forte">Sua eficiência nos últimos {rotuloPeriodo}.</p>
          </div>
        </div>

        <div className="flex justify-center lg:px-6">
          <MeiaLua valor={eficiencia.geral.eficiencia} cor="rgb(var(--color-brand-forte))" rotulo="Eficiência" />
        </div>

        <div className="grid grid-cols-3 gap-2 lg:px-6">
          <Anel
            rotulo="Atrasadas"
            cor="var(--viz-atrasadas)"
            quantidade={eficiencia.geral.atrasadas}
            valor={parte(eficiencia.geral.atrasadas, eficiencia.geral.total)}
          />
          <Anel
            rotulo="Abertas"
            cor="var(--viz-abertas)"
            quantidade={eficiencia.geral.abertas}
            valor={parte(eficiencia.geral.abertas, eficiencia.geral.total)}
          />
          <Anel
            rotulo="Realizadas"
            cor="var(--viz-realizadas)"
            quantidade={eficiencia.geral.realizadas}
            valor={parte(eficiencia.geral.realizadas, eficiencia.geral.total)}
          />
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm lg:pl-6">
          <dt className="col-span-2 mb-1 text-sm font-semibold text-ink">Atividades</dt>
          <dt className="text-ink-muted">Atrasadas</dt>
          <dd data-mov="numero" className="text-right font-semibold text-ink">{eficiencia.geral.atrasadas}</dd>
          <dt className="text-ink-muted">Realizadas</dt>
          <dd data-mov="numero" className="text-right font-semibold text-ink">{eficiencia.geral.realizadas}</dd>
          <dt className="text-ink-muted">Abertas</dt>
          <dd data-mov="numero" className="text-right font-semibold text-ink">{eficiencia.geral.abertas}</dd>
          <dt className="border-t border-line pt-1 text-ink-muted">Total</dt>
          <dd data-mov="numero" className="border-t border-line pt-1 text-right font-semibold text-ink">
            {eficiencia.geral.total}
          </dd>
        </dl>
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <CartaoEficiencia
          eficiencia={eficiencia}
          taxaNoPrazo={painel.taxaNoPrazo}
          tempoMedio={formatarDuracao(painel.tempoMedioDias)}
          concluidas={painel.concluidas}
          variacao={variacao}
        />
        <CaixaDeEntrada itens={caixaDeEntrada} posts={postsComAjuste} nomeDe={nomeDe} className="lg:col-span-2" />
      </section>

      {otimizacoes && (
        <CartaoOtimizacoes itens={otimizacoes} nomeDe={nomeDe} rotuloPeriodo={rotuloPeriodo} />
      )}

      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-ink">Concluídas por semana</p>
          <p className="mt-0.5 text-xs text-ink-muted">Últimas {semanas} semanas</p>
          <GraficoSemanas dados={painel.porSemana} />
        </div>

        <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-ink">Por cliente</p>
          <p className="mt-0.5 text-xs text-ink-muted">Concluídas nos últimos {rotuloPeriodo}</p>
          {painel.porCliente.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Nada concluído no período.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {painel.porCliente.slice(0, 6).map((c) => (
                <li key={c.projectId ?? "geral"} data-mov="item">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-ink">{nomeDe(c.projectId)}</span>
                    <span className="font-medium text-ink">{c.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-hover">
                    <div
                      data-mov="barra"
                      className="h-full rounded-full bg-brand-forte"
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
    </Coreografia>
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
    <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">
        {titulo} <span className="font-normal text-ink-muted">({tarefas.length})</span>
      </p>
      {tarefas.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{vazio}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {tarefas.slice(0, 8).map((t) => (
            <li key={t.id} data-mov="item">
              <Link
                href={t.project_id ? `/projetos/${t.project_id}` : "/board"}
                className="flex items-center justify-between gap-3 py-2 hover:text-brand-forte"
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

const MAX_OTIMIZACOES = 8;

// Otimizações do tráfego registradas pela pessoa (aba "Otimizações" dos
// clientes): quantas foram, em quantos dias, onde, e as mais recentes.
function CartaoOtimizacoes({
  itens,
  nomeDe,
  rotuloPeriodo,
}: {
  itens: OtimizacaoDoPainel[];
  nomeDe: (id: string | null) => string;
  rotuloPeriodo: string;
}) {
  const dias = new Set(itens.map((i) => i.opt_date)).size;
  const clientes = new Set(itens.map((i) => i.project_id)).size;
  const porLocal = Array.from(
    itens.reduce((mapa, i) => mapa.set(i.place, (mapa.get(i.place) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">
        Otimizações <span className="font-normal text-ink-muted">({itens.length})</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Registradas nos últimos {rotuloPeriodo}
        {itens.length > 0 &&
          ` · ${dias} ${dias === 1 ? "dia" : "dias"} com registro · ${clientes} ${clientes === 1 ? "cliente" : "clientes"}`}
      </p>

      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nenhuma otimização registrada no período.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {porLocal.map(([local, total]) => (
              <Badge key={local} tone="neutral">
                {local} · {total}
              </Badge>
            ))}
          </div>

          <ul className="mt-3 divide-y divide-line">
            {itens.slice(0, MAX_OTIMIZACOES).map((o) => (
              <li key={o.id} data-mov="item">
                <Link
                  href={`/projetos/${o.project_id}`}
                  className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 hover:text-brand-forte"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{o.action_taken}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {nomeDe(o.project_id)} · {o.place}
                      {o.justification && ` · ${o.justification}`}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-ink-muted">{formatarPrazo(o.opt_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {itens.length > MAX_OTIMIZACOES && (
            <p className="mt-2 text-xs text-ink-muted">e mais {itens.length - MAX_OTIMIZACOES}.</p>
          )}
        </>
      )}
    </section>
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

const CATEGORIA_DO_POST: Record<string, string> = { carrossel: "Carrossel", estatico: "Post estático", reel: "Reel" };

function CaixaDeEntrada({
  itens,
  posts,
  nomeDe,
  className = "",
}: {
  itens: ItemCaixaDeEntrada[];
  posts: PostComAjuste[];
  nomeDe: (id: string | null) => string;
  className?: string;
}) {
  const novas = itens.filter((i) => i.nova).length;
  const hoje = diaSP(new Date());
  return (
    <section data-mov="card" className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          Caixa de entrada <span className="font-normal text-ink-muted">({itens.length + posts.length})</span>
        </p>
        <Link href="/solicitacoes" className="text-xs font-medium text-brand-forte hover:underline">
          Ver solicitações →
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        Tarefas e demandas que chegaram pra você e ainda não foram iniciadas
        {novas > 0 && ` · ${novas} nova${novas === 1 ? "" : "s"}`}
      </p>

      {itens.length + posts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nada esperando por você. 🎉</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {/* Posts em que o cliente pediu ajuste vêm primeiro: tem alguém esperando. */}
          {posts.map((post) => (
            <li key={post.id} data-mov="item">
              <Link
                href={`/projetos/${post.project_id}?aba=posts`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:text-brand-forte"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">O cliente pediu ajuste num post</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {nomeDe(post.project_id)} · {CATEGORIA_DO_POST[post.category] ?? "Post"}
                    {post.scheduled_date && ` · previsto para ${formatarPrazo(post.scheduled_date)}`}
                  </span>
                </span>
                <Badge tone="warning">Ajuste pedido</Badge>
              </Link>
            </li>
          ))}
          {itens.slice(0, MAX_CAIXA).map((item) => {
            const t = item.tarefa;
            return (
              <li key={t.id} data-mov="item">
                <Link
                  href={t.project_id ? `/projetos/${t.project_id}` : "/board"}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:text-brand-forte"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {item.nova && (
                        <span data-mov="ponto" className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-forte" aria-hidden="true" />
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
                      <span
                        className={`text-xs ${t.due_date < hoje ? "font-medium text-danger" : "text-ink-muted"}`}
                      >
                        {t.due_date < hoje ? "venceu " : "até "}
                        {formatarPrazo(t.due_date)}
                      </span>
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

function parte(n: number, total: number) {
  return total ? n / total : null;
}

function pctTexto(valor: number | null) {
  return valor === null ? "—" : `${Math.round(valor * 100)}%`;
}

// Cartão "Eficiência": anéis concêntricos (Total, Tarefas e Demandas),
// barras com o percentual de cada um e o detalhe por categoria.
function CartaoEficiencia({
  eficiencia,
  taxaNoPrazo,
  tempoMedio,
  concluidas,
  variacao,
}: {
  eficiencia: Eficiencia;
  taxaNoPrazo: number | null;
  tempoMedio: string;
  concluidas: number;
  variacao: number;
}) {
  const categorias: { rotulo: string; cor: string; bloco: BlocoEficiencia }[] = [
    { rotulo: "Tarefas", cor: "var(--viz-tarefas)", bloco: eficiencia.tarefas },
    { rotulo: "Demandas", cor: "var(--viz-demandas)", bloco: eficiencia.demandas },
  ];
  const total = { rotulo: "Total", cor: "rgb(var(--color-brand-forte))", bloco: eficiencia.geral };

  return (
    <section data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Eficiência</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Atividades em dia: nem atrasadas, nem entregues depois do prazo
      </p>

      <div className="mt-4 flex justify-center">
        <AneisConcentricos
          rotuloCentro="Total"
          valorCentro={eficiencia.geral.eficiencia}
          aneis={[total, ...categorias].map((c) => ({
            rotulo: c.rotulo,
            cor: c.cor,
            valor: c.bloco.eficiencia,
          }))}
        />
      </div>

      <div className="mt-4 space-y-2">
        {[...categorias, total].map((c) => (
          <div key={c.rotulo}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} aria-hidden="true" />
                {c.rotulo}
              </span>
              <span data-mov="numero" className="font-semibold text-ink">{pctTexto(c.bloco.eficiencia)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-hover">
              <div
                data-mov="barra"
                className="h-full rounded-full"
                style={{ width: `${(c.bloco.eficiencia ?? 0) * 100}%`, background: c.cor }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {categorias.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-line">
            <p className="border-b border-line py-1.5 text-center text-xs font-semibold text-ink">
              {c.rotulo}
            </p>
            <dl className="px-2 py-1 text-xs">
              {(
                [
                  ["Atrasadas", c.bloco.atrasadas],
                  ["Em progresso", c.bloco.emProgresso],
                  ["Realizadas", c.bloco.realizadas],
                  ["Total", c.bloco.total],
                ] as const
              ).map(([rotulo, n]) => (
                <div key={rotulo} className="flex justify-between py-0.5">
                  <dt className="text-ink-muted">{rotulo}</dt>
                  <dd data-mov="numero" className="font-medium text-ink">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <dt className="text-ink-muted">Entregas no prazo</dt>
          <dd className="font-semibold text-ink">{pctTexto(taxaNoPrazo)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tempo médio de entrega</dt>
          <dd className="font-semibold text-ink">{tempoMedio}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">Concluídas no período</dt>
          <dd className="font-semibold text-ink">
            {concluidas}{" "}
            <span className="font-normal text-ink-muted">
              {variacao === 0
                ? "(igual ao período anterior)"
                : `(${variacao > 0 ? "▲" : "▼"} ${Math.abs(variacao)} vs período anterior)`}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function juntarNomes(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
