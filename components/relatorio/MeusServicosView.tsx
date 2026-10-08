import type { Envio, ServicoDoCatalogo } from "@/lib/faturamento";
import { formatarDataBR } from "@/lib/format";
import { nomeDoMes } from "@/lib/relatorio";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import Coreografia from "@/components/movimento/Coreografia";
import RelatorioAbas from "./RelatorioAbas";
import RelatorioControles from "./RelatorioControles";
import EnviarServico from "./EnviarServico";
import DesistirDoEnvio from "./DesistirDoEnvio";
import EnviarTarefas, { type MinhaTarefa } from "./EnviarTarefas";

const SITUACAO = {
  pending: { rotulo: "Aguardando análise", tom: "warning" },
  accepted: { rotulo: "Aceito", tom: "success" },
  declined: { rotulo: "Recusado", tom: "danger" },
} as const;

// Aba "Meus serviços" (ver app/(app)/relatorio/servicos.tsx): formulário de
// envio e a lista do que a pessoa já enviou no mês, com a situação de cada
// um. Sem preço em lugar nenhum.
export default function MeusServicosView({
  mes,
  ehMesAtual,
  clientes,
  catalogo,
  envios,
  tarefas,
  semMigracao,
  erroDeCarga,
}: {
  mes: string;
  ehMesAtual: boolean;
  clientes: { id: string; nome: string }[];
  catalogo: ServicoDoCatalogo[];
  envios: Envio[];
  // Tarefas de cliente que a pessoa concluiu no mês; null = falta a 0048.
  tarefas: MinhaTarefa[] | null;
  semMigracao: boolean;
  erroDeCarga: boolean;
}) {
  const nomeDoCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Cliente";
  const pendentes = envios.filter((e) => e.status === "pending").length;

  return (
    <Coreografia key={`srv-${mes}`}>
      <main className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Relatório mensal"
          subtitle={`Seus serviços em ${nomeDoMes(mes)}: informe o que você fez pra cada cliente.`}
        />

        <RelatorioAbas atual="servicos" mes={mes} mostrarFaturamento={false} />

        <RelatorioControles aba="servicos" mes={mes} ehMesAtual={ehMesAtual} filtro={null} semImpressao />

        {erroDeCarga ? (
          <p className="rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            Não deu pra carregar os seus serviços agora. Recarregue a página; se continuar, avise quem cuida
            do sistema.
          </p>
        ) : semMigracao ? (
          <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            O envio de serviços ainda não está disponível: falta rodar a migration 0047_envio_de_servicos.sql
            no Supabase.
          </p>
        ) : (
          <>
            {tarefas && tarefas.length > 0 && <EnviarTarefas tarefas={tarefas} catalogo={catalogo} mes={mes} />}

            <div className={tarefas && tarefas.length > 0 ? "mt-3" : ""}>
              <EnviarServico mes={mes} clientes={clientes} catalogo={catalogo} />
            </div>

            <section data-mov="card" className="mt-3 rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-ink">
                Enviados em {nomeDoMes(mes).split(" de ")[0]}{" "}
                <span className="font-normal text-ink-muted">({envios.length})</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {envios.length === 0
                  ? "O que você enviar aparece aqui, com a resposta do faturamento."
                  : pendentes > 0
                    ? `${pendentes} aguardando análise. Enquanto aguarda, dá pra desistir do envio.`
                    : "Todos já foram analisados."}
              </p>

              {envios.length > 0 && (
                <ul className="mt-3 divide-y divide-line">
                  {envios.map((e) => (
                    <li key={e.id} data-mov="item" className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {e.quantity !== 1 &&
                            `${e.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} × `}
                          {e.service_name}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {nomeDoCliente(e.project_id)}
                          {e.detail && ` · ${e.detail}`}
                          {` · enviado em ${formatarDataBR(e.created_at)}`}
                        </span>
                        {e.status === "declined" && e.review_note && (
                          <span className="mt-1 block text-xs text-danger">Motivo: {e.review_note}</span>
                        )}
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        <Badge tone={SITUACAO[e.status].tom}>{SITUACAO[e.status].rotulo}</Badge>
                        {e.status === "pending" && <DesistirDoEnvio id={e.id} nome={e.service_name} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </Coreografia>
  );
}
