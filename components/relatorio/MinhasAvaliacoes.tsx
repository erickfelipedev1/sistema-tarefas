import type { Avaliacao } from "@/lib/avaliacoes";
import { PageHeader } from "@/components/ui/PageHeader";
import Coreografia from "@/components/movimento/Coreografia";
import RelatorioAbas from "./RelatorioAbas";
import AvaliacaoRecebida from "./AvaliacaoRecebida";

// Aba "Avaliações" pra quem é avaliado: as avaliações que a pessoa recebeu,
// da mais recente pra mais antiga, cada uma com espaço pra responder. Só
// chegam aqui as já enviadas (a RLS de evaluations não entrega rascunho).
export default function MinhasAvaliacoes({
  avaliacoes,
  mes,
  mostrarFaturamento,
  erroDeCarga,
  semMigracao,
}: {
  avaliacoes: Avaliacao[];
  mes: string;
  mostrarFaturamento: boolean;
  erroDeCarga: boolean;
  semMigracao: boolean;
}) {
  return (
    <Coreografia>
      <main className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Relatório mensal"
          subtitle="Suas avaliações: o retorno da liderança sobre o seu trabalho em cada mês."
        />

        <RelatorioAbas atual="avaliacoes" mes={mes} mostrarFaturamento={mostrarFaturamento} />

        {erroDeCarga ? (
          <p className="rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
            Não deu pra carregar as suas avaliações agora. Recarregue a página; se continuar, avise quem
            cuida do sistema.
          </p>
        ) : semMigracao ? (
          <p className="rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
            As avaliações ainda não estão disponíveis: falta rodar a migration 0046_avaliacoes.sql no Supabase.
          </p>
        ) : avaliacoes.length === 0 ? (
          <p
            data-mov="card"
            className="rounded-2xl border border-line bg-surface px-5 py-10 text-center text-sm text-ink-muted"
          >
            Você ainda não recebeu nenhuma avaliação. Quando chegar uma, ela aparece aqui.
          </p>
        ) : (
          <div className="space-y-3">
            {avaliacoes.map((a) => (
              <AvaliacaoRecebida key={a.id} avaliacao={a} />
            ))}
          </div>
        )}
      </main>
    </Coreografia>
  );
}
