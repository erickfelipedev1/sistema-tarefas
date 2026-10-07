import Link from "next/link";
import { nomeDoMes, somarMes, type Relatorio, type Totais } from "@/lib/relatorio";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import Coreografia from "@/components/movimento/Coreografia";
import RelatorioAbas from "./RelatorioAbas";
import RelatorioControles from "./RelatorioControles";
import RelatorioObservacoes from "./RelatorioObservacoes";
import EditarTime from "./EditarTime";

interface Pessoa {
  id: string;
  nome: string;
  avatar: string | null;
}

// Aba "Entregas do time" do Relatório mensal — recebe tudo já calculado (ver
// app/(app)/relatorio/entregas.tsx e lib/relatorio.ts). Feita pra ser lida na
// tela e impressa (ou salva em PDF): o que é controle leva "nao-imprime".
export default function RelatorioView({
  relatorio,
  totaisAnterior,
  mes,
  ehMesAtual,
  dono,
  donoNome,
  souDono,
  verTudo,
  times,
  pessoas,
  nomesProjetos,
  observacoes,
  semMigracao,
  usuarioId,
  mostrarAbas,
  dadosIncompletos,
}: {
  relatorio: Relatorio;
  totaisAnterior: Totais;
  mes: string;
  ehMesAtual: boolean;
  dono: string;
  donoNome: string;
  souDono: boolean;
  verTudo: boolean;
  // Só pra quem tem "ve_tudo": os times que dá pra escolher.
  times: { id: string; nome: string }[] | null;
  pessoas: Pessoa[];
  nomesProjetos: Record<string, string>;
  observacoes: string;
  semMigracao: boolean;
  usuarioId: string;
  // As abas só existem pra quem também vê Faturamento.
  mostrarAbas: boolean;
  // Alguma consulta falhou ou passou do teto: os números podem estar a menos.
  dadosIncompletos: boolean;
}) {
  const t = relatorio.totais;
  const equipeInteira = dono === "todos";
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p]));
  const nomeDe = (id: string) => pessoaPorId.get(id)?.nome ?? "Sem nome";
  const clienteDe = (id: string | null) => (id ? nomesProjetos[id] ?? "Cliente" : "Geral (sem cliente)");
  const mesPassado = nomeDoMes(somarMes(mes, -1)).split(" de ")[0];
  const temOtimizacoes = t.otimizacoes > 0;
  const podeEditar = !equipeInteira && (souDono || verTudo);
  const titulo = equipeInteira ? "Equipe inteira" : relatorio.pessoas.length > 1 ? `Time de ${donoNome}` : donoNome;

  return (
    <Coreografia key={`${mes}-${dono}`}>
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Relatório mensal"
          subtitle={`${titulo} · ${nomeDoMes(mes)}${ehMesAtual ? " (mês em andamento)" : ""}`}
        />

        {mostrarAbas && <RelatorioAbas atual="entregas" mes={mes} />}

        <RelatorioControles
          aba="entregas"
          mes={mes}
          ehMesAtual={ehMesAtual}
          filtro={times ? { parametro: "time", rotulo: "Time", valor: dono, opcoes: times } : null}
        />

        {dadosIncompletos && (
          <p className="mb-5 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            Não deu pra carregar todos os dados deste relatório, então os números abaixo podem estar a
            menos. Recarregue a página; se continuar, avise quem cuida do sistema.
          </p>
        )}

        {semMigracao && (
          <p className="nao-imprime mb-5 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            Falta rodar a migration 0044_relatorio_mensal.sql no Supabase — sem ela não dá pra montar o
            time nem salvar as observações, e o relatório mostra só as suas entregas.
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Resumo
            rotulo="Entregas"
            valor={String(t.entregues)}
            detalhe={variacao(t.entregues, totaisAnterior.entregues, mesPassado)}
          />
          <Resumo
            rotulo="No prazo"
            valor={t.taxaNoPrazo === null ? "—" : `${Math.round(t.taxaNoPrazo * 100)}%`}
            detalhe={
              t.noPrazo + t.comAtraso === 0
                ? "Nenhuma entrega com prazo"
                : `${t.noPrazo} de ${t.noPrazo + t.comAtraso} com prazo · ${t.comAtraso} com atraso`
            }
          />
          <Resumo
            rotulo={ehMesAtual ? "Em aberto hoje" : "Em aberto no fim do mês"}
            valor={String(t.emAberto)}
            detalhe={t.atrasadas === 0 ? "Nenhuma atrasada" : `${t.atrasadas} ${t.atrasadas === 1 ? "atrasada" : "atrasadas"}`}
            alerta={t.atrasadas > 0}
          />
          <Resumo
            rotulo="Horas lançadas"
            valor={`${formatarHoras(t.horas)} h`}
            detalhe={variacao(t.horas, totaisAnterior.horas, mesPassado, " h")}
          />
        </section>

        <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-ink">Por pessoa</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Tarefa com mais de uma pessoa do time conta na linha de cada uma, e uma vez só no total
          </p>
          <div className="mt-3 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Pessoa</th>
                  <th className="px-2 py-2 text-right font-medium">Entregas</th>
                  <th className="px-2 py-2 text-right font-medium">No prazo</th>
                  <th className="px-2 py-2 text-right font-medium">Com atraso</th>
                  <th className="px-2 py-2 text-right font-medium">Em aberto</th>
                  <th className="px-2 py-2 text-right font-medium">Atrasadas</th>
                  <th className="px-2 py-2 text-right font-medium">Demandas</th>
                  {temOtimizacoes && <th className="px-2 py-2 text-right font-medium">Otimizações</th>}
                  <th className="py-2 pl-2 text-right font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.pessoas.map((p) => (
                  <tr key={p.id} data-mov="item" className="border-t border-line">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={nomeDe(p.id)} src={pessoaPorId.get(p.id)?.avatar} />
                        <span className="truncate font-medium text-ink">{nomeDe(p.id)}</span>
                        {!equipeInteira && p.id === dono && relatorio.pessoas.length > 1 && (
                          <Badge tone="brand">líder</Badge>
                        )}
                      </span>
                    </td>
                    <Celulas totais={p} temOtimizacoes={temOtimizacoes} />
                  </tr>
                ))}
              </tbody>
              {relatorio.pessoas.length > 1 && (
                <tfoot>
                  <tr className="border-t border-ink-muted/40 font-semibold">
                    <td className="py-2 pr-3 text-ink">Total do time</td>
                    <Celulas totais={t} temOtimizacoes={temOtimizacoes} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="mt-3 grid gap-3 lg:grid-cols-3">
          <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
            <p className="text-sm font-semibold text-ink">
              Entregas por cliente <span className="font-normal text-ink-muted">({t.entregues})</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">Tarefas concluídas em {nomeDoMes(mes)}</p>
            {relatorio.porCliente.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">Nenhuma tarefa concluída no mês.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {relatorio.porCliente.map((c) => (
                  <div key={c.projectId ?? "geral"} className="break-inside-avoid">
                    <p className="flex items-baseline justify-between gap-2 border-b border-line pb-1 text-sm font-medium text-ink">
                      {c.projectId ? (
                        <Link href={`/projetos/${c.projectId}`} className="truncate hover:text-brand-forte">
                          {clienteDe(c.projectId)}
                        </Link>
                      ) : (
                        <span className="truncate">{clienteDe(null)}</span>
                      )}
                      <span className="flex-shrink-0 text-xs font-normal text-ink-muted">
                        {c.entregas.length} {c.entregas.length === 1 ? "entrega" : "entregas"}
                      </span>
                    </p>
                    <ul className="mt-1">
                      {c.entregas.map((e) => (
                        <li key={e.id} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                          <span className="min-w-0">
                            <span className="text-ink">{e.title}</span>
                            <span className="text-xs text-ink-muted"> · {e.responsaveis.map(nomeDe).join(", ")}</span>
                          </span>
                          <span className={`flex-shrink-0 text-xs ${e.comAtraso ? "font-medium text-danger" : "text-ink-muted"}`}>
                            {formatarDia(e.dia)}
                            {e.comAtraso && " · atrasou"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-ink">Demandas recebidas</p>
            <p className="mt-0.5 text-xs text-ink-muted">Pedidos que chegaram por Solicitações no mês</p>
            <p className="mt-4 text-3xl font-semibold leading-none text-ink">{relatorio.demandas.recebidas}</p>
            <p className="mt-1.5 text-xs text-ink-muted">
              {variacao(relatorio.demandas.recebidas, totaisAnterior.demandas, mesPassado)}
            </p>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              {(
                [
                  ["Aceitas", relatorio.demandas.aceitas],
                  ["Já concluídas", relatorio.demandas.concluidas],
                  ["Aguardando resposta", relatorio.demandas.pendentes],
                  ["Recusadas", relatorio.demandas.recusadas],
                ] as const
              ).map(([rotulo, n]) => (
                <div key={rotulo} className="flex justify-between">
                  <dt className="text-ink-muted">{rotulo}</dt>
                  <dd className="font-semibold text-ink">{n}</dd>
                </div>
              ))}
            </dl>
            {temOtimizacoes && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
                <span className="font-medium text-ink">{t.otimizacoes}</span>{" "}
                {t.otimizacoes === 1 ? "otimização registrada" : "otimizações registradas"} no mês
              </p>
            )}
          </div>
        </section>

        {!equipeInteira && (
          <RelatorioObservacoes
            dono={dono}
            mes={mes}
            usuarioId={usuarioId}
            inicial={observacoes}
            podeEditar={podeEditar && !semMigracao}
          />
        )}

        {podeEditar && !semMigracao && (
          <EditarTime
            lider={dono}
            liderNome={donoNome}
            pessoas={pessoas.filter((p) => p.id !== dono).map((p) => ({ id: p.id, nome: p.nome }))}
            membrosIniciais={relatorio.pessoas.map((p) => p.id).filter((id) => id !== dono)}
          />
        )}
      </main>
    </Coreografia>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div data-mov="card" className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-ink">{valor}</p>
      <p className={`mt-2 text-xs ${alerta ? "font-medium text-danger" : "text-ink-muted"}`}>{detalhe}</p>
    </div>
  );
}

function Celulas({ totais, temOtimizacoes }: { totais: Totais; temOtimizacoes: boolean }) {
  const celula = "px-2 py-2 text-right tabular-nums";
  return (
    <>
      <td className={`${celula} font-semibold text-ink`}>{totais.entregues}</td>
      <td className={`${celula} text-ink`}>
        {totais.taxaNoPrazo === null ? "—" : `${Math.round(totais.taxaNoPrazo * 100)}%`}
      </td>
      <td className={`${celula} ${totais.comAtraso > 0 ? "text-danger" : "text-ink-muted"}`}>{totais.comAtraso}</td>
      <td className={`${celula} text-ink`}>{totais.emAberto}</td>
      <td className={`${celula} ${totais.atrasadas > 0 ? "text-danger" : "text-ink-muted"}`}>{totais.atrasadas}</td>
      <td className={`${celula} text-ink`}>{totais.demandas}</td>
      {temOtimizacoes && <td className={`${celula} text-ink`}>{totais.otimizacoes}</td>}
      <td className="py-2 pl-2 text-right tabular-nums text-ink">{formatarHoras(totais.horas)}</td>
    </>
  );
}

function formatarHoras(horas: number) {
  return horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function formatarDia(dia: string) {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

// "▲ 3 a mais que em setembro" / "igual a setembro"
function variacao(atual: number, anterior: number, mesPassado: string, unidade = "") {
  const diferenca = atual - anterior;
  if (Math.abs(diferenca) < 0.05) return `Igual a ${mesPassado}`;
  const n = Math.abs(diferenca).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${diferenca > 0 ? "▲" : "▼"} ${n}${unidade} ${diferenca > 0 ? "a mais" : "a menos"} que em ${mesPassado}`;
}
