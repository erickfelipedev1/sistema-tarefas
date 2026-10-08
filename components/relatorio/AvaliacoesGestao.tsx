import Link from "next/link";
import { formatarMedia, mediaDasNotas, notasCompletas, situacao, type Avaliacao } from "@/lib/avaliacoes";
import { nomeDoMes, type Totais } from "@/lib/relatorio";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import RelatorioAbas from "./RelatorioAbas";
import RelatorioControles from "./RelatorioControles";
import AvaliacaoForm from "./AvaliacaoForm";
import AvaliacaoRecebida from "./AvaliacaoRecebida";

interface Pessoa {
  id: string;
  nome: string;
  avatar: string | null;
}

// Aba "Avaliações" pra quem avalia (ver app/(app)/relatorio/avaliacoes.tsx).
// Sem pessoa escolhida: a lista da equipe com a situação de cada um no mês.
// Com pessoa: a ficha dela — formulário, números de entrega e histórico.
export default function AvaliacoesGestao({
  mes,
  ehMesAtual,
  pessoas,
  avaliacoesDoMes,
  pessoa,
  historico,
  entregas,
  recebidas,
  mostrarFaturamento,
  semMigracao,
  erroDeCarga,
}: {
  mes: string;
  ehMesAtual: boolean;
  pessoas: Pessoa[];
  avaliacoesDoMes: Avaliacao[];
  pessoa: Pessoa | null;
  historico: Avaliacao[];
  // Números de entrega da pessoa no mês; null = não deu pra carregar.
  entregas: Totais | null;
  // Avaliações que quem está olhando recebeu de outra pessoa com visão geral.
  recebidas: Avaliacao[];
  mostrarFaturamento: boolean;
  semMigracao: boolean;
  erroDeCarga: boolean;
}) {
  const porPessoa = new Map(avaliacoesDoMes.map((a) => [a.person_id, a]));
  const enviadas = avaliacoesDoMes.filter((a) => a.status === "sent");
  const medias = enviadas.map(mediaDasNotas).filter((m): m is number => m !== null);
  const mediaGeral = medias.length
    ? Math.round((medias.reduce((soma, m) => soma + m, 0) / medias.length) * 10) / 10
    : null;
  const doMes = pessoa ? porPessoa.get(pessoa.id) ?? null : null;
  const anteriores = historico.filter((a) => a.month.slice(0, 7) !== mes && a.status === "sent");

  return (
    <Coreografia key={`ava-${mes}-${pessoa?.id ?? "todos"}`}>
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Relatório mensal"
          subtitle={
            pessoa ? `Avaliação de ${pessoa.nome} · ${nomeDoMes(mes)}` : `Avaliações da equipe · ${nomeDoMes(mes)}`
          }
        />

        <RelatorioAbas atual="avaliacoes" mes={mes} mostrarFaturamento={mostrarFaturamento} />

        <RelatorioControles
          aba="avaliacoes"
          mes={mes}
          ehMesAtual={ehMesAtual}
          filtro={{
            parametro: "pessoa",
            rotulo: "Colaborador",
            valor: pessoa?.id ?? "",
            opcoes: [{ id: "", nome: "Toda a equipe" }, ...pessoas.map((p) => ({ id: p.id, nome: p.nome }))],
          }}
        />

        {erroDeCarga ? (
          <p className="rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            Não deu pra carregar as avaliações agora. Recarregue a página; se continuar, avise quem cuida
            do sistema.
          </p>
        ) : semMigracao ? (
          <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            Falta rodar a migration 0046_avaliacoes.sql no Supabase — sem ela não tem onde guardar as
            avaliações.
          </p>
        ) : pessoa ? (
          <>
            <Link
              href={`/relatorio?aba=avaliacoes&mes=${mes}`}
              data-mov="topo"
              className="nao-imprime mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Toda a equipe
            </Link>

            <div className="grid gap-3 lg:grid-cols-3">
              <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Avatar name={pessoa.nome} src={pessoa.avatar} size="md" />
                  <p className="text-base font-semibold text-ink">{pessoa.nome}</p>
                  <Badge tone={situacao(doMes).tom}>{situacao(doMes).rotulo}</Badge>
                </div>
                <AvaliacaoForm pessoaId={pessoa.id} pessoaNome={pessoa.nome} mes={mes} avaliacao={doMes} />
              </div>

              <div className="space-y-3">
                <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-sm font-semibold text-ink">Entregas em {nomeDoMes(mes).split(" de ")[0]}</p>
                  {entregas ? (
                    <dl className="mt-3 space-y-1 text-sm">
                      {(
                        [
                          ["Tarefas entregues", String(entregas.entregues)],
                          [
                            "No prazo",
                            entregas.taxaNoPrazo === null ? "—" : `${Math.round(entregas.taxaNoPrazo * 100)}%`,
                          ],
                          ["Entregues com atraso", String(entregas.comAtraso)],
                          [ehMesAtual ? "Em aberto hoje" : "Em aberto no fim do mês", String(entregas.emAberto)],
                          ["Atrasadas", String(entregas.atrasadas)],
                          [
                            "Horas lançadas",
                            entregas.horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
                          ],
                        ] as const
                      ).map(([rotulo, valor]) => (
                        <div key={rotulo} className="flex justify-between gap-3">
                          <dt className="text-ink-muted">{rotulo}</dt>
                          <dd className="font-semibold tabular-nums text-ink">{valor}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-ink-muted">Não deu pra carregar os números de entrega.</p>
                  )}
                  <Link
                    href={`/relatorio?aba=entregas&mes=${mes}&time=${pessoa.id}`}
                    className="nao-imprime mt-3 inline-block text-xs font-medium text-brand-forte hover:underline"
                  >
                    Ver as entregas em detalhe →
                  </Link>
                </div>

                <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-sm font-semibold text-ink">Avaliações anteriores</p>
                  {anteriores.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-muted">Nenhuma avaliação enviada antes deste mês.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line">
                      {anteriores.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/relatorio?aba=avaliacoes&mes=${a.month.slice(0, 7)}&pessoa=${pessoa.id}`}
                            className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-forte"
                          >
                            <span className="text-ink">{nomeDoMes(a.month.slice(0, 7))}</span>
                            <span className="font-semibold tabular-nums text-ink">
                              {formatarMedia(mediaDasNotas(a))}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Resumo
                rotulo="Avaliações enviadas"
                valor={`${enviadas.length} de ${pessoas.length}`}
                detalhe={
                  avaliacoesDoMes.length - enviadas.length > 0
                    ? `${avaliacoesDoMes.length - enviadas.length} em rascunho`
                    : "Nenhum rascunho pendente"
                }
              />
              <Resumo
                rotulo="Média do mês"
                valor={formatarMedia(mediaGeral)}
                detalhe="Entre as avaliações enviadas, de 1 a 5"
              />
              <Resumo
                rotulo="Respostas"
                valor={String(enviadas.filter((a) => a.reply).length)}
                detalhe="Colaboradores que responderam"
              />
            </section>

            <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Equipe</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Escolha um colaborador pra avaliar. Ele só vê a avaliação depois que você enviar.
              </p>
              <ul className="mt-3 divide-y divide-line">
                {pessoas.map((p) => {
                  const a = porPessoa.get(p.id) ?? null;
                  const s = situacao(a);
                  return (
                    <li key={p.id} data-mov="item">
                      <Link
                        href={`/relatorio?aba=avaliacoes&mes=${mes}&pessoa=${p.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-forte"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={p.nome} src={p.avatar} />
                          <span className="truncate text-sm font-medium text-ink">{p.nome}</span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-3">
                          {a && notasCompletas(a) && (
                            <span className="text-sm font-semibold tabular-nums text-ink">
                              {formatarMedia(mediaDasNotas(a))}
                            </span>
                          )}
                          <Badge tone={s.tom}>{s.rotulo}</Badge>
                          <ChevronRightIcon className="h-3.5 w-3.5 text-ink-muted" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {recebidas.length > 0 && (
              <div className="mt-6 space-y-3">
                <p data-mov="topo" className="text-sm font-semibold text-ink">
                  Avaliações que você recebeu
                </p>
                {recebidas.map((a) => (
                  <AvaliacaoRecebida key={a.id} avaliacao={a} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </Coreografia>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div data-mov="card" className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight tabular-nums text-ink">{valor}</p>
      <p className="mt-2 text-xs text-ink-muted">{detalhe}</p>
    </div>
  );
}
