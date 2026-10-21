import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshIcon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import AtualizacoesView from "@/components/AtualizacoesView";

// Menu "Atualizações": o que mudou no d.hub (conteúdo em lib/atualizacoes.ts).
export default function AtualizacoesPage() {
  return (
    <Coreografia>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<RefreshIcon className="h-8 w-8" />}
          title="Atualizações"
          subtitle="O que mudou no d.hub, do mais novo pro mais antigo."
        />
        <AtualizacoesView />
      </main>
    </Coreografia>
  );
}
