import { notFound } from "next/navigation";
import { clienteDaRequisicao, perfilAtual } from "@/lib/sessao";
import Coreografia from "@/components/movimento/Coreografia";
import MapeamentoView from "@/components/estrategia/MapeamentoView";
import { normalizarNotas } from "@/lib/estrategia/perguntas";
import {
  COLUNAS_DA_ETAPA,
  COLUNAS_DA_RESPOSTA,
  COLUNAS_DO_MAPEAMENTO,
  type EstEtapa,
  type EstMapeamento,
  type EstResposta,
} from "@/lib/estrategia/tipos";

export const metadata = { title: "Estratégia · d.hub" };

// A geração por IA pode levar minutos; as ações do servidor chamadas daqui herdam este limite.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// As notas vêm de um jsonb: só passa o que tem a forma certa (um registro torto
// não derruba a tela do mapeamento pra todo mundo).
function respostasLidas(linhas: unknown[]): EstResposta[] {
  return (linhas as (Omit<EstResposta, "notas"> & { notas: unknown })[]).map((r) => {
    const origem = (r.notas as { origem?: string } | null)?.origem === "ia" ? "ia" : "humano";
    return { ...r, notas: r.notas ? normalizarNotas(r.notas, origem) : null };
  });
}

export default async function MapeamentoPage({ params }: { params: { id: string } }) {
  const { id } = params;
  if (!UUID.test(id)) notFound();

  const supabase = await clienteDaRequisicao();
  const [perfil, { data: mapeamento }, { data: etapas, error: erroDasEtapas }, { data: profiles }] = await Promise.all([
    perfilAtual(),
    supabase.from("est_mapeamentos").select(COLUNAS_DO_MAPEAMENTO).eq("id", id).maybeSingle(),
    supabase.from("est_etapas").select(COLUNAS_DA_ETAPA).eq("mapeamento_id", id),
    supabase.from("profiles").select("id, username, name, ativo").order("name", { ascending: true }),
  ]);
  if (!mapeamento) notFound();
  const m = mapeamento as unknown as EstMapeamento;

  const { data: cliente } = await supabase.from("projects").select("id, name").eq("id", m.project_id).maybeSingle();

  // Respostas do kickoff. Se a tabela ainda não existe (migration 0106), a página abre sem elas.
  const { data: respostas, error: erroDasRespostas } = await supabase
    .from("est_respostas")
    .select(COLUNAS_DA_RESPOSTA)
    .eq("mapeamento_id", id);
  const kickoffForaDoBanco =
    !!erroDasRespostas && (erroDasRespostas.code === "42P01" || /does not exist/i.test(erroDasRespostas.message ?? ""));

  return (
    <Coreografia>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {erroDasEtapas && (
          <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" role="alert">
            Não deu pra carregar as etapas agora. Recarregue a página antes de editar.
          </p>
        )}
        {kickoffForaDoBanco && (
          <p className="mb-4 text-xs text-ink-muted">O kickoff ainda não está liberado no banco (migration 0106).</p>
        )}
        <MapeamentoView
          mapeamento={m}
          etapas={(etapas ?? []) as unknown as EstEtapa[]}
          cliente={cliente ?? { id: m.project_id, name: "Cliente" }}
          profiles={profiles ?? []}
          souDirecao={perfil?.ve_tudo === true}
          respostas={respostasLidas(erroDasRespostas ? [] : respostas ?? [])}
          iaLigada={!!process.env.ANTHROPIC_API_KEY}
        />
      </main>
    </Coreografia>
  );
}
