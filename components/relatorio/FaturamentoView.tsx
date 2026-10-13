import type { Faturamento, Pacote, Servico } from "@/lib/faturamento";
import type { InvoiceItem } from "@/lib/types";
import { nomeDoMes, somarMes } from "@/lib/relatorio";
import { formatarMoeda } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import Coreografia from "@/components/movimento/Coreografia";
import RelatorioAbas from "./RelatorioAbas";
import RelatorioControles from "./RelatorioControles";
import LancarServico from "./LancarServico";
import AcoesDoLancamento from "./AcoesDoLancamento";
import CatalogoServicos from "./CatalogoServicos";
import PacotesCatalogo from "./PacotesCatalogo";
import PacotesDosClientes from "./PacotesDosClientes";
import Link from "next/link";
import EnviarAoCliente, { type FaturaDoMes } from "./EnviarAoCliente";
import EnviosPendentes, { type EnvioPendente } from "./EnviosPendentes";

// Aba "Faturamento" do Relatório mensal — recebe tudo já calculado (ver
// app/(app)/relatorio/faturamento.tsx e lib/faturamento.ts). Cada cliente
// aparece com o pacote mensal dele (valor fixo e o que inclui) e, embaixo, os
// extras lançados no mês. Com um cliente escolhido no filtro, a impressão
// vira o documento que vai pra ele: só o pacote, os extras e os valores, sem
// controles e sem a coluna de quem fez.
export default function FaturamentoView({
  faturamento,
  totalAnterior,
  mes,
  ehMesAtual,
  cliente,
  clientes,
  pessoas,
  servicos,
  pacotes,
  pacotePorCliente,
  semPacotes,
  semMigracao,
  erroDeCarga,
  faturasDoMes,
  usuarioRotulo,
  enviosDoMes,
  enviosEmOutrosMeses,
  enviosComErro,
}: {
  faturamento: Faturamento;
  totalAnterior: number;
  mes: string;
  ehMesAtual: boolean;
  cliente: string | null;
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  servicos: Servico[];
  pacotes: Pacote[];
  // O pacote que cada cliente tem neste mês.
  pacotePorCliente: Record<string, { pacoteId: string; desde: string; ultimoMes: boolean }>;
  // Falta a migration 0053: a tela segue só com os extras.
  semPacotes: boolean;
  semMigracao: boolean;
  // Alguma consulta falhou: os totais não são confiáveis, então nem aparecem.
  erroDeCarga: boolean;
  // Fatura já enviada a cada cliente neste mês; null = falta a migration
  // 0045, e aí não dá pra enviar.
  faturasDoMes: Record<string, FaturaDoMes> | null;
  usuarioRotulo: string;
  // Serviços que a equipe enviou antes dos pacotes e ainda esperam análise:
  // os deste mês (já filtrados pelo cliente escolhido) e a contagem dos
  // outros meses.
  enviosDoMes: EnvioPendente[];
  enviosEmOutrosMeses: { mes: string; nome: string; total: number }[];
  // A lista de envios da equipe não carregou inteira.
  enviosComErro: boolean;
}) {
  const nomeDoCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Cliente";
  const nomeDaPessoa = (id: string | null) => (id ? pessoas.find((p) => p.id === id)?.nome ?? "—" : "—");
  const mesPassado = nomeDoMes(somarMes(mes, -1)).split(" de ")[0];
  const diferenca = faturamento.total - totalAnterior;
  const mensais = faturamento.porCliente.reduce((n, c) => n + c.linhas.filter((l) => l.recurring).length, 0);
  // Coluna interna: some do papel quando o documento é pra um cliente só.
  const colunaInterna = cliente ? "nao-imprime" : "";

  return (
    <Coreografia key={`fat-${mes}-${cliente ?? "todos"}`}>
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title={cliente ? "Relatório de serviços" : "Relatório mensal"}
          subtitle={
            cliente
              ? `${nomeDoCliente(cliente)} · ${nomeDoMes(mes)}`
              : `Faturamento · todos os clientes · ${nomeDoMes(mes)}`
          }
        />

        <RelatorioAbas atual="faturamento" mes={mes} mostrarFaturamento />

        <RelatorioControles
          aba="faturamento"
          mes={mes}
          ehMesAtual={ehMesAtual}
          filtro={{
            parametro: "cliente",
            rotulo: "Cliente",
            valor: cliente ?? "",
            opcoes: [{ id: "", nome: "Todos os clientes" }, ...clientes],
          }}
        />

        {erroDeCarga ? (
          <p className="rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            Não deu pra carregar o faturamento agora. Recarregue a página; se continuar, avise quem cuida
            do sistema.
          </p>
        ) : semMigracao ? (
          <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            Falta rodar a migration 0044_relatorio_mensal.sql no Supabase — sem ela não existe o catálogo
            de serviços nem onde guardar os lançamentos.
          </p>
        ) : (
          <>
            {semPacotes && (
              <p className="nao-imprime mb-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
                Falta rodar a migration 0053_pacotes.sql no Supabase — sem ela não existem os pacotes (Start, Pro,
                Elite), e o faturamento mostra só os serviços lançados à mão.
              </p>
            )}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Resumo
                rotulo={cliente ? "Total do mês" : "Faturamento do mês"}
                valor={formatarMoeda(faturamento.total)}
                detalhe={
                  Math.abs(diferenca) < 0.005
                    ? `Igual a ${mesPassado}`
                    : `${diferenca > 0 ? "▲" : "▼"} ${formatarMoeda(Math.abs(diferenca))} ${
                        diferenca > 0 ? "a mais" : "a menos"
                      } que em ${mesPassado}`
                }
                detalheSoNaTela
              />
              {!cliente && (
                <Resumo
                  rotulo="Clientes com pacote"
                  valor={String(faturamento.clientesComPacote)}
                  detalhe={`de ${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
                />
              )}
              <Resumo
                rotulo="Extras no mês"
                valor={String(faturamento.quantidadeDeLinhas)}
                detalhe={mensais === 1 ? "1 mensal" : `${mensais} mensais`}
              />
            </section>

            {enviosComErro && (
              <p className="nao-imprime mt-3 rounded-xl border border-danger/30 bg-danger-light px-4 py-2.5 text-xs text-danger">
                Não deu pra carregar todos os serviços enviados pela equipe; pode haver envios esperando análise
                que não aparecem aqui. Recarregue a página.
              </p>
            )}

            {enviosDoMes.length > 0 && <EnviosPendentes envios={enviosDoMes} />}

            {enviosEmOutrosMeses.length > 0 && (
              <p className="nao-imprime mt-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-ink-muted">
                Ainda há serviços enviados pela equipe esperando análise em outros meses:{" "}
                {enviosEmOutrosMeses.map((o, i) => (
                  <span key={o.mes}>
                    {i > 0 && ", "}
                    <Link
                      href={`/relatorio?aba=faturamento&mes=${o.mes}${cliente ? `&cliente=${cliente}` : ""}`}
                      className="font-medium text-brand-forte hover:underline"
                    >
                      {o.total} em {o.nome}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}

            <LancarServico
              mes={mes}
              clienteInicial={cliente}
              clientes={clientes}
              pessoas={pessoas}
              servicos={servicos.filter((s) => s.active)}
            />

            {faturamento.porCliente.length === 0 ? (
              <p
                data-mov="card"
                className="mt-3 rounded-2xl border border-line bg-surface px-5 py-10 text-center text-sm text-ink-muted"
              >
                Nenhum pacote nem serviço extra em {nomeDoMes(mes)}
                {cliente ? ` para ${nomeDoCliente(cliente)}` : ""}.
              </p>
            ) : (
              faturamento.porCliente.map((c) => {
                // O que vai pra fatura: a linha do pacote, os serviços que
                // ele inclui (sem valor) e os extras.
                const itens: InvoiceItem[] = [
                  ...(c.pacote
                    ? [
                        {
                          name: `Pacote ${c.pacote.nome}`,
                          detail: null,
                          quantity: 1,
                          unit_price: c.pacote.preco,
                          total: c.pacote.preco,
                          recurring: true,
                        },
                        ...c.pacote.itens.map((nome) => ({
                          name: nome,
                          detail: null,
                          quantity: 1,
                          unit_price: 0,
                          total: 0,
                          recurring: false,
                          included: true,
                        })),
                      ]
                    : []),
                  ...c.linhas.map((l) => ({
                    name: l.service_name,
                    detail: l.detail,
                    quantity: l.quantity,
                    unit_price: l.unit_price,
                    total: l.total,
                    recurring: l.recurring,
                  })),
                ];
                return (
                  <section
                    key={c.projectId}
                    data-mov="card"
                    className="mt-3 break-inside-avoid rounded-2xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{nomeDoCliente(c.projectId)}</p>
                      <p className="text-sm font-semibold tabular-nums text-ink">{formatarMoeda(c.total)}</p>
                    </div>

                    {c.pacote && (
                      <div data-mov="item" className="mt-3 rounded-xl border border-line bg-canvas px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-ink">Pacote {c.pacote.nome}</span>
                            <Badge tone="brand">mensal</Badge>
                            {c.pacote.ultimoMes && (
                              <span className="nao-imprime">
                                <Badge tone="warning">último mês</Badge>
                              </span>
                            )}
                            <span className="nao-imprime text-xs text-ink-muted">desde {nomeDoMes(c.pacote.desde)}</span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-ink">
                            {formatarMoeda(c.pacote.preco)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-ink-muted">
                          {c.pacote.itens.length > 0
                            ? `Inclui: ${c.pacote.itens.join(", ")}.`
                            : "Nenhum serviço marcado como incluído neste pacote ainda."}
                        </p>
                        {c.pacote.preco === 0 && (
                          <p className="nao-imprime mt-1.5 text-xs font-medium text-warning">
                            Este pacote está sem valor. Preencha em &quot;Pacotes&quot;, lá embaixo.
                          </p>
                        )}
                      </div>
                    )}

                    {c.linhas.length > 0 && (
                      <div className="mt-3 overflow-x-auto scrollbar-thin">
                        {c.pacote && <p className="mb-1 text-xs font-semibold text-ink-muted">Extras</p>}
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead>
                            <tr className="text-xs text-ink-muted">
                              <th className="py-2 pr-3 font-medium">Serviço</th>
                              <th className={`px-2 py-2 font-medium ${colunaInterna}`}>Quem fez</th>
                              <th className="px-2 py-2 text-right font-medium">Qtd.</th>
                              <th className="px-2 py-2 text-right font-medium">Valor unitário</th>
                              <th className="py-2 pl-2 text-right font-medium">Total</th>
                              <th className="nao-imprime py-2 pl-2" aria-label="Ações" />
                            </tr>
                          </thead>
                          <tbody>
                            {c.linhas.map((l) => (
                              <tr key={l.id} data-mov="item" className="border-t border-line align-top">
                                <td className="py-2 pr-3">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium text-ink">{l.service_name}</span>
                                    {l.recurring && <Badge tone="brand">mensal</Badge>}
                                    {l.recurring && l.ended_month?.slice(0, 7) === mes && (
                                      <span className="nao-imprime">
                                        <Badge tone="warning">último mês</Badge>
                                      </span>
                                    )}
                                  </span>
                                  {l.detail && <span className="block text-xs text-ink-muted">{l.detail}</span>}
                                </td>
                                <td className={`px-2 py-2 text-ink-muted ${colunaInterna}`}>{nomeDaPessoa(l.done_by)}</td>
                                <td className="px-2 py-2 text-right tabular-nums text-ink">
                                  {l.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums text-ink">
                                  {formatarMoeda(l.unit_price)}
                                </td>
                                <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">
                                  {formatarMoeda(l.total)}
                                </td>
                                <td className="nao-imprime py-1.5 pl-2 text-right">
                                  <AcoesDoLancamento
                                    id={l.id}
                                    nome={l.service_name}
                                    mes={mes}
                                    mensal={l.recurring}
                                    soExisteNesteMes={
                                      !l.recurring ||
                                      (l.entry_month.slice(0, 7) === mes && l.ended_month?.slice(0, 7) === mes)
                                    }
                                    encerraNesteMes={l.ended_month?.slice(0, 7) === mes}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {faturasDoMes ? (
                      <EnviarAoCliente
                        projectId={c.projectId}
                        clienteNome={nomeDoCliente(c.projectId)}
                        mes={mes}
                        total={c.total}
                        itens={itens}
                        fatura={faturasDoMes[c.projectId] ?? null}
                        usuarioRotulo={usuarioRotulo}
                      />
                    ) : (
                      <p className="nao-imprime mt-3 border-t border-line pt-3 text-xs text-warning">
                        Pra enviar ao cliente falta rodar a migration 0045_fatura_do_relatorio.sql no Supabase.
                      </p>
                    )}
                  </section>
                );
              })
            )}

            {faturamento.porCliente.length > 1 && (
              <p
                data-mov="card"
                className="mt-3 flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm font-semibold text-ink"
              >
                <span>Total de {nomeDoMes(mes)}</span>
                <span className="text-lg tabular-nums">{formatarMoeda(faturamento.total)}</span>
              </p>
            )}

            {!semPacotes && (
              <>
                <PacotesDosClientes
                  mes={mes}
                  clientes={cliente ? clientes.filter((c) => c.id === cliente) : clientes}
                  pacotes={pacotes}
                  pacotePorCliente={pacotePorCliente}
                />
                <PacotesCatalogo mes={mes} pacotes={pacotes} servicos={servicos} />
              </>
            )}
            <CatalogoServicos servicos={servicos} />
          </>
        )}
      </main>
    </Coreografia>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  detalheSoNaTela = false,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  // O comparativo com o mês anterior é informação interna: não vai pro papel.
  detalheSoNaTela?: boolean;
}) {
  return (
    <div data-mov="card" className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums text-ink">{valor}</p>
      <p className={`mt-2 text-xs text-ink-muted ${detalheSoNaTela ? "nao-imprime" : ""}`}>{detalhe}</p>
    </div>
  );
}
