import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Project, Task } from "@/lib/types";
import { STATUS_OPTIONS, REPEAT_OPTIONS } from "@/lib/task-options";
import { corTarefa } from "@/lib/task-colors";

// Todo bloco que a gente gera automaticamente na página da Wiki (o "resumo
// da tarefa") usa esse prefixo no id. Assim dá pra achar e trocar só essa
// parte depois — o resto da página continua livre pra pessoa escrever.
const PREFIXO_RESUMO = "resumo-tarefa-";

function linha(id: string, rotulo: string, valor: string) {
  return {
    id: `${PREFIXO_RESUMO}${id}`,
    type: "paragraph",
    content: [
      { type: "text", text: `${rotulo}: `, styles: { bold: true } },
      { type: "text", text: valor, styles: {} },
    ],
  };
}

function formatarData(dueDate: string | null) {
  if (!dueDate) return "Sem data";
  const partes = dueDate.split("-");
  if (partes.length !== 3) return dueDate;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

// Monta os blocos (formato BlockNote) do resumo da tarefa, com os valores
// atuais — chamado toda vez que algo na tarefa muda, pra manter a Wiki
// sempre atualizada.
export function buildTaskSummaryBlocks(
  task: Task,
  profiles: Profile[],
  projects: Project[]
) {
  const statusLabel =
    STATUS_OPTIONS.find((s) => s.key === task.status)?.label ?? task.status;
  const repeatLabel =
    REPEAT_OPTIONS.find((r) => r.key === task.repeat_rule)?.label ?? "Nunca";

  const responsavel = task.assigned_to
    ? profiles.find((p) => p.id === task.assigned_to)
    : null;
  const responsavelNome = responsavel
    ? responsavel.name || responsavel.username || "Alguém"
    : "Ninguém";

  const projeto = task.project_id
    ? projects.find((p) => p.id === task.project_id)
    : null;

  const cor = corTarefa(task.color).nome;

  const blocos: unknown[] = [
    {
      id: `${PREFIXO_RESUMO}heading`,
      type: "heading",
      props: { level: 3 },
      content: "📋 Resumo da tarefa",
    },
    linha("titulo", "Título", task.title),
  ];

  if (task.description) {
    blocos.push(linha("descricao", "Descrição", task.description));
  }

  blocos.push(
    linha("status", "Status", statusLabel),
    linha("data", "Data", formatarData(task.due_date)),
    linha(
      "horario",
      "Horário",
      task.due_time ? task.due_time.slice(0, 5) : "Sem horário"
    ),
    linha("repetir", "Repetir", repeatLabel),
    linha("responsavel", "Responsável", responsavelNome),
    linha("projeto", "Projeto", projeto ? projeto.name : "Geral"),
    linha("cor", "Cor", cor),
    {
      id: `${PREFIXO_RESUMO}fim`,
      type: "paragraph",
    }
  );

  return blocos;
}

// Troca só os blocos do resumo (identificados pelo prefixo no id) dentro
// do conteúdo existente da página — tudo que a pessoa escreveu por conta
// própria embaixo continua intacto.
export function mesclarResumoNoConteudo(
  conteudoAtual: unknown,
  blocosResumo: unknown[]
) {
  const resto = Array.isArray(conteudoAtual)
    ? (conteudoAtual as { id?: string }[]).filter(
        (bloco) => !bloco?.id || !bloco.id.startsWith(PREFIXO_RESUMO)
      )
    : [];
  return [...blocosResumo, ...resto];
}

// Atualiza a página da Wiki vinculada à tarefa (se houver) com o resumo
// mais recente. Não faz nada se a tarefa ainda não tiver página vinculada.
export async function syncTaskWiki(
  supabase: SupabaseClient,
  task: Task,
  profiles: Profile[],
  projects: Project[]
) {
  if (!task.page_id) return;

  const { data: pagina } = await supabase
    .from("pages")
    .select("content")
    .eq("id", task.page_id)
    .maybeSingle();

  const novoConteudo = mesclarResumoNoConteudo(
    pagina?.content,
    buildTaskSummaryBlocks(task, profiles, projects)
  );

  await supabase
    .from("pages")
    .update({ content: novoConteudo, updated_at: new Date().toISOString() })
    .eq("id", task.page_id);
}
