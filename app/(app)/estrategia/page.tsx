import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import { clientesDaEstrategia } from "@/lib/estrategia/clientes";
import Coreografia from "@/components/movimento/Coreografia";
import EstrategiaPainel from "@/components/estrategia/EstrategiaPainel";
import { PageHeader } from "@/components/ui/PageHeader";
import { TargetIcon } from "@/components/ui/icons";
import { COLUNAS_DO_MAPEAMENTO, type EstMapeamento } from "@/lib/estrategia/tipos";
import type { StatusDaEtapa } from "@/lib/estrategia/etapas";

export const metadata = { title: "Estratégia · d.hub" };

function tabelaNaoExiste(erro: { code?: string; message?: string } | null): boolean {
  return !!erro && (erro.code === "42P01" || /does not exist/i.test(erro.message ?? ""));
}

// Painel de próximas ações do d.estratégia: os mapeamentos de cada cliente e o
// que está pedindo atenção agora.
export default async function EstrategiaPage() {
  const supabase = await clienteDaRequisicao();
  const [usuario, perfil] = await Promise.all([usuarioAtual(), perfilAtual()]);
  const souDirecao = perfil?.ve_tudo === true;
  const [mapeamentos, etapas, clientes, profiles] = await Promise.all([
    supabase.from("est_mapeamentos").select(COLUNAS_DO_MAPEAMENTO).order("created_at", { ascending: false }),
    supabase.from("est_etapas").select("mapeamento_id, codigo, status, vence_em"),
    clientesDaEstrategia(supabase, usuario?.id ?? "", souDirecao),
    supabase.from("profiles").select("id, username, name, ativo").order("name", { ascending: true }),
  ]);

  const semTabela = tabelaNaoExiste(mapeamentos.error) || tabelaNaoExiste(etapas.error);
  const falhou = !semTabela && !!(mapeamentos.error || etapas.error || clientes.error);

  return (
    <Coreografia>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Estratégia"
          subtitle="Os mapeamentos de cada cliente, etapa por etapa, e o que precisa de ação agora."
          icon={<TargetIcon className="h-6 w-6" />}
        />
        {semTabela ? (
          <p className="rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
            O d.estratégia ainda não está liberado no banco (migration 0104).
          </p>
        ) : falhou ? (
          <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" role="alert">
            Não deu pra carregar os mapeamentos agora. Recarregue a página; se continuar, avise o Erick.
          </p>
        ) : (
          <div data-mov="card">
            <EstrategiaPainel
              mapeamentos={(mapeamentos.data ?? []) as unknown as EstMapeamento[]}
              etapas={(etapas.data ?? []) as unknown as { mapeamento_id: string; codigo: string; status: StatusDaEtapa; vence_em: string }[]}
              clientes={clientes.data ?? []}
              profiles={profiles.data ?? []}
              souDirecao={souDirecao}
            />
          </div>
        )}
      </main>
    </Coreografia>
  );
}
