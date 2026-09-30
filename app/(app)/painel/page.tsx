import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { podeVerTudo } from "@/lib/permissions";
import {
  calcularEficiencia,
  calcularPainel,
  montarCaixaDeEntrada,
  type PedidoRecebido,
  type TarefaMetrica,
} from "@/lib/painel";
import PainelView from "@/components/painel/PainelView";
import { escalaDeHojePara, type PerfilBasico } from "@/lib/regras";

export const dynamic = "force-dynamic";

const PERIODOS = {
  "7": { dias: 7, semanas: 8, rotulo: "7 dias" },
  "30": { dias: 30, semanas: 8, rotulo: "30 dias" },
  "90": { dias: 90, semanas: 13, rotulo: "90 dias" },
} as const;
type ChavePeriodo = keyof typeof PERIODOS;

const COLUNAS = "id, title, status, due_date, created_at, project_id, created_by, created_by_label";

// Painel de eficiência: as métricas de entrega de quem está logado (ou, pra
// quem tem "ve_tudo", de qualquer pessoa da equipe). Conta as tarefas em
// que a pessoa é responsável.
export default async function PainelPage({
  searchParams,
}: {
  searchParams: { periodo?: string; pessoa?: string };
}) {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const chave: ChavePeriodo =
    searchParams.periodo && searchParams.periodo in PERIODOS
      ? (searchParams.periodo as ChavePeriodo)
      : "30";
  const periodo = PERIODOS[chave];

  const verTudo = await podeVerTudo(supabase, user.id);
  const pessoaId = verTudo && searchParams.pessoa ? searchParams.pessoa : user.id;

  const [{ data: perfis }, { data: projetos }] = await Promise.all([
    supabase.from("profiles").select("id, name, username, email, avatar_url").order("name"),
    supabase.from("projects").select("id, name"),
  ]);
  const pessoa = (perfis ?? []).find((p) => p.id === pessoaId);
  // Cargo (migration 0034) à parte, pra não derrubar a lista de perfis sem ela.
  const { data: comCargo } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", pessoaId)
    .maybeSingle();

  // completed_at vem da migration 0033 — sem ela, o painel ainda abre, só
  // sem as métricas de prazo/tempo.
  let semMigracao = false;
  const comData = await supabase
    .from("tasks")
    .select(`${COLUNAS}, completed_at`)
    .contains("assigned_to", [pessoaId]);
  let linhas: unknown[] | null = comData.data;
  if (comData.error) {
    semMigracao = true;
    const semData = await supabase.from("tasks").select(COLUNAS).contains("assigned_to", [pessoaId]);
    linhas = semData.data;
  }
  const tarefas = ((linhas ?? []) as Partial<TarefaMetrica>[]).map((t) => ({
    completed_at: null,
    ...t,
  })) as TarefaMetrica[];

  const painel = calcularPainel(tarefas, { dias: periodo.dias, semanas: periodo.semanas });

  // Caixa de entrada: pedidos recebidos em Solicitações + tarefas que outra
  // pessoa atribuiu (ver montarCaixaDeEntrada). client_login_id vem da
  // migration 0032.
  const { data: pedidos } = await supabase
    .from("task_requests")
    .select("task_id, requested_by_label, urgency, demand_type, client_login_id")
    .eq("requested_to", pessoaId);
  const eficiencia = calcularEficiencia(
    tarefas,
    new Set((pedidos ?? []).map((p) => p.task_id).filter(Boolean) as string[]),
    { dias: periodo.dias }
  );
  const caixaDeEntrada = montarCaixaDeEntrada(
    tarefas,
    (pedidos ?? []) as PedidoRecebido[],
    pessoaId
  );

  // Horas lançadas nas tarefas (task_hours guarda quem lançou pelo rótulo).
  const rotulos = [pessoa?.username, pessoa?.email].filter(Boolean) as string[];
  const desde = new Date(Date.now() - periodo.dias * 24 * 60 * 60 * 1000).toISOString();
  const { data: horas } = rotulos.length
    ? await supabase
        .from("task_hours")
        .select("hours")
        .in("created_by_label", rotulos)
        .gte("created_at", desde)
    : { data: [] as { hours: number }[] };
  const totalHoras = (horas ?? []).reduce((soma, h) => soma + Number(h.hours), 0);

  const nomesProjetos = Object.fromEntries(
    (projetos ?? []).map((p) => [p.id as string, p.name as string])
  );

  return (
    <PainelView
      painel={painel}
      eficiencia={eficiencia}
      pessoaNome={pessoa?.name || pessoa?.username || "—"}
      pessoaAvatar={pessoa?.avatar_url ?? null}
      pessoaCargo={(comCargo?.cargo as string | null | undefined) ?? null}
      caixaDeEntrada={caixaDeEntrada}
      periodoChave={chave}
      periodos={Object.entries(PERIODOS).map(([valor, p]) => ({ valor, rotulo: p.rotulo }))}
      rotuloPeriodo={periodo.rotulo}
      semanas={periodo.semanas}
      pessoas={
        verTudo
          ? (perfis ?? []).map((p) => ({ id: p.id, nome: p.name || p.username || "Sem nome" }))
          : null
      }
      pessoaAtual={pessoaId}
      subtitulo={
        pessoaId === user.id
          ? "Suas entregas: o que foi concluído, no prazo e o que precisa de atenção."
          : `Entregas de ${pessoa?.name || pessoa?.username || "—"}.`
      }
      semMigracao={semMigracao}
      totalHoras={totalHoras}
      nomesProjetos={nomesProjetos}
      lembreteLixo={
        pessoaId === user.id ? escalaDeHojePara(user.id, (perfis ?? []) as PerfilBasico[]) : null
      }
    />
  );
}
