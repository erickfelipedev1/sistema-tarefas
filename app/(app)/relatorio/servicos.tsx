import type { SupabaseClient } from "@supabase/supabase-js";
import type { Envio, ServicoDoCatalogo } from "@/lib/faturamento";
import { diaSP } from "@/lib/painel";
import { limitesDoMes, mesAtual } from "@/lib/relatorio";
import MeusServicosView from "@/components/relatorio/MeusServicosView";
import type { MinhaTarefa } from "@/components/relatorio/EnviarTarefas";

// Aba "Meus serviços": o colaborador informa o que fez pra cada cliente no mês
// e acompanha se o faturamento aceitou. Não mostra preço — a lista de serviços
// vem de catalogo_de_servicos() (migration 0047), que só devolve nome e tipo.
export default async function AbaServicos({
  supabase,
  userId,
  mes,
}: {
  supabase: SupabaseClient;
  userId: string;
  mes: string;
}) {
  // Uma margem de um dia pra cada lado cobre o fuso; o corte exato é por diaSP.
  const { inicio, fim } = limitesDoMes(mes);
  const desde = new Date(`${inicio}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 1);
  const ate = new Date(`${fim}T23:59:59Z`);
  ate.setUTCDate(ate.getUTCDate() + 1);

  const [{ data: projetos }, catalogo, envios, tarefasRes] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.rpc("catalogo_de_servicos"),
    // "*": task_id só existe depois da migration 0048.
    supabase
      .from("service_submissions")
      .select("*")
      .eq("submitted_by", userId)
      .eq("month", `${mes}-01`)
      .order("created_at", { ascending: false }),
    // Tarefas de cliente que a pessoa concluiu no mês.
    supabase
      .from("tasks")
      .select("id, title, project_id, completed_at")
      .contains("assigned_to", [userId])
      .eq("status", "done")
      .not("project_id", "is", null)
      .gte("completed_at", desde.toISOString())
      .lte("completed_at", ate.toISOString())
      .order("completed_at", { ascending: false })
      .limit(300),
  ]);
  const nomeDoCliente = new Map((projetos ?? []).map((p) => [p.id as string, p.name as string]));
  const meusEnvios = (envios.data ?? []) as Envio[];

  // O que já aconteceu com cada tarefa: enviada por mim (pendente/recusada),
  // ou já lançada / marcada "não cobrar" pelo faturamento (função da 0048,
  // que não devolve preço). Sem a 0048 a lista de tarefas não aparece.
  const doMes = ((tarefasRes.data ?? []) as { id: string; title: string; project_id: string; completed_at: string }[]).filter(
    (t) => {
      const dia = diaSP(t.completed_at);
      return dia >= inicio && dia <= fim;
    }
  );
  const situacoes = doMes.length
    ? await supabase.rpc("situacao_das_minhas_tarefas", { p_task_ids: doMes.map((t) => t.id) })
    : { data: [], error: null };
  const noFaturamento = new Map(
    ((situacoes.data ?? []) as { tarefa_id: string; situacao: "lancada" | "dispensada" }[]).map((s) => [s.tarefa_id, s.situacao])
  );
  const tarefas: MinhaTarefa[] | null = situacoes.error
    ? null
    : doMes.map((t) => {
        const envio = meusEnvios.find((e) => e.task_id === t.id && e.status !== "accepted");
        const [, m, d] = diaSP(t.completed_at).split("-");
        return {
          id: t.id,
          titulo: t.title,
          projectId: t.project_id,
          clienteNome: nomeDoCliente.get(t.project_id) ?? "Cliente",
          dia: `${d}/${m}`,
          situacao:
            noFaturamento.get(t.id) ??
            (envio?.status === "pending" ? "enviada" : envio?.status === "declined" ? "recusada" : "livre"),
        };
      });

  // Tabela ou função que não existe = falta a migration 0047.
  const falta = (erro: { code?: string } | null) =>
    !!erro && ["42P01", "42883", "PGRST202", "PGRST205"].includes(erro.code ?? "");
  const semMigracao = falta(catalogo.error) || falta(envios.error);

  return (
    <MeusServicosView
      mes={mes}
      ehMesAtual={mes === mesAtual()}
      clientes={(projetos ?? []).map((p) => ({ id: p.id as string, nome: p.name as string }))}
      catalogo={(catalogo.data ?? []) as ServicoDoCatalogo[]}
      envios={meusEnvios.map((e) => ({ ...e, quantity: Number(e.quantity) || 0 }))}
      tarefas={tarefas}
      semMigracao={semMigracao}
      erroDeCarga={!semMigracao && (!!catalogo.error || !!envios.error)}
    />
  );
}
