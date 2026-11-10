import { notFound } from "next/navigation";
import { clienteDaRequisicao, perfilAtual } from "@/lib/sessao";
import Coreografia from "@/components/movimento/Coreografia";
import MapeamentoView from "@/components/estrategia/MapeamentoView";
import { COLUNAS_DA_ETAPA, COLUNAS_DO_MAPEAMENTO, type EstEtapa, type EstMapeamento } from "@/lib/estrategia/tipos";

export const metadata = { title: "Estratégia · d.hub" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MapeamentoPage({ params }: { params: { id: string } }) {
  const { id } = params;
  if (!UUID.test(id)) notFound();

  const supabase = await clienteDaRequisicao();
  const [perfil, { data: mapeamento }, { data: etapas }, { data: profiles }] = await Promise.all([
    perfilAtual(),
    supabase.from("est_mapeamentos").select(COLUNAS_DO_MAPEAMENTO).eq("id", id).maybeSingle(),
    supabase.from("est_etapas").select(COLUNAS_DA_ETAPA).eq("mapeamento_id", id),
    supabase.from("profiles").select("id, username, name, ativo").order("name", { ascending: true }),
  ]);
  if (!mapeamento) notFound();
  const m = mapeamento as unknown as EstMapeamento;

  const { data: cliente } = await supabase.from("projects").select("id, name").eq("id", m.project_id).maybeSingle();

  return (
    <Coreografia>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <MapeamentoView
          mapeamento={m}
          etapas={(etapas ?? []) as unknown as EstEtapa[]}
          cliente={cliente ?? { id: m.project_id, name: "Cliente" }}
          profiles={profiles ?? []}
          souDirecao={perfil?.ve_tudo === true}
        />
      </main>
    </Coreografia>
  );
}
