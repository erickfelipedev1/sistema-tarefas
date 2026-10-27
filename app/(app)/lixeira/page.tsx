import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Trash2Icon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import LixeiraView, { type TarefaNaLixeira } from "@/components/LixeiraView";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Lixeira de tarefas (migration 0094): o que foi excluído fica aqui 30 dias
// e pode ser restaurado, com comentários, checklist, anexos e horas.
export default async function LixeiraPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = await clienteDaRequisicao();

  const [{ data, error }, { data: projetos }] = await Promise.all([
    supabase
      .from("tarefas_excluidas")
      .select("id, titulo, tarefa, relacionados, excluida_em, excluida_por_nome")
      .order("excluida_em", { ascending: false }),
    supabase.from("projects").select("id, name"),
  ]);

  const nomeDoCliente = new Map((projetos ?? []).map((p) => [p.id as string, p.name as string]));
  const itens: TarefaNaLixeira[] = (data ?? []).map((r) => {
    const tarefa = (r.tarefa ?? {}) as Record<string, unknown>;
    const rel = (r.relacionados ?? {}) as Record<string, unknown[] | undefined>;
    return {
      id: r.id as string,
      titulo: r.titulo as string,
      status: (tarefa.status as string) ?? "todo",
      cliente: nomeDoCliente.get(tarefa.project_id as string) ?? null,
      entrega: (tarefa.due_date as string | null) ?? null,
      ehSubtarefa: !!tarefa.parent_id,
      excluidaEm: r.excluida_em as string,
      excluidaPor: (r.excluida_por_nome as string | null) ?? null,
      comentarios: rel.comentarios?.length ?? 0,
      anexos: rel.anexos?.length ?? 0,
      checklist: rel.checklist?.length ?? 0,
      horas: rel.horas?.length ?? 0,
    };
  });

  return (
    <Coreografia>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<Trash2Icon className="h-8 w-8" />}
          title="Lixeira"
          subtitle="Tarefas excluídas ficam aqui por 30 dias e podem ser restauradas."
        />
        <LixeiraView itens={itens} semMigration={!!error} />
      </main>
    </Coreografia>
  );
}
