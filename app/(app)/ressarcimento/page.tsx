import { PageHeader } from "@/components/ui/PageHeader";
import { WalletIcon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import RessarcimentoView from "@/components/ressarcimento/RessarcimentoView";
import { perfilAtual, usuarioAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Menu "Ressarcimento": a equipe lança despesas pagas do próprio bolso e o
// financeiro acompanha por quinzena (migration 0123).
export default async function RessarcimentoPage({ searchParams }: { searchParams?: { lote?: string } }) {
  const user = await usuarioAtual();
  const perfil = await perfilAtual();
  // Quem cuida dos ressarcimentos (profiles.cuida_ressarcimentos; hoje só a Emilly).
  const financeiro = perfil?.cuida_ressarcimentos === true;
  const meuNome =
    (perfil?.name as string | undefined) ||
    (perfil?.username as string | undefined) ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const lote = searchParams?.lote;
  const loteInicial = lote && /^\d{4}-\d{2}-\d{2}$/.test(lote) ? lote : null;

  return (
    <Coreografia>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<WalletIcon className="h-8 w-8" />}
          title="Ressarcimento"
          subtitle="Lance o que você pagou do próprio bolso pela empresa. Nos dias 1 e 16, o que estiver pendente vai para o financeiro."
        />
        <RessarcimentoView euId={user?.id ?? ""} meuNome={meuNome} financeiro={financeiro} loteInicial={loteInicial} />
      </main>
    </Coreografia>
  );
}
