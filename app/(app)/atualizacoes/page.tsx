import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshIcon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import AtualizacoesView from "@/components/AtualizacoesView";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Menu "Atualizações": o que mudou no d.hub (conteúdo em lib/atualizacoes.ts)
// e os pedidos de alteração da equipe (migration 0088).
export default async function AtualizacoesPage({ searchParams }: { searchParams?: { aba?: string } }) {
  const user = await usuarioAtual();
  const perfil = await perfilAtual();
  const supabase = await clienteDaRequisicao();
  const { data: quemAprova } = await supabase.from("profiles").select("*").eq("aprova_pedidos_dhub", true);
  const nomes = (quemAprova ?? []).map((p) => (p.name as string) || (p.username as string)).filter(Boolean);
  const rotulo =
    (perfil?.name as string | undefined) ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";

  return (
    <Coreografia>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<RefreshIcon className="h-8 w-8" />}
          title="Atualizações"
          subtitle="O que mudou no d.hub e os pedidos de alteração da equipe."
        />
        <AtualizacoesView
          abaInicial={searchParams?.aba === "pedidos" ? "pedidos" : "novidades"}
          pedidos={{
            euId: user?.id ?? "",
            euRotulo: rotulo,
            aprova: perfil?.aprova_pedidos_dhub === true,
            executa: perfil?.executa_pedidos_dhub === true,
            nomeDeQuemAprova: nomes.length ? nomes.join(" ou ") : "a liderança",
          }}
        />
      </main>
    </Coreografia>
  );
}
