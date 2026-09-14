import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChecklistItem,
  Profile,
  Project,
  Task,
  TaskAttachment,
  TaskComment,
  TaskHourEntry,
} from "@/lib/types";
import { STATUS_OPTIONS, REPEAT_OPTIONS } from "@/lib/task-options";
import { corTarefa } from "@/lib/task-colors";

// Cada seção que a gente gera automaticamente na página da Wiki (resumo,
// checklist, anexos, comentários, horas) usa um prefixo próprio no id dos
// blocos. Assim dá pra achar e trocar só aquela seção depois, sem mexer no
// resto — nem nas outras seções, nem no que a pessoa escreveu por conta
// própria na página.
const PREFIXO_RESUMO = "resumo-tarefa-";
const PREFIXO_CHECKLIST = "checklist-tarefa-";
const PREFIXO_ANEXOS = "anexos-tarefa-";
const PREFIXO_COMENTARIOS = "comentarios-tarefa-";
const PREFIXO_HORAS = "horas-tarefa-";

// Ordem em que as seções aparecem na página, sempre — não importa qual
// seção foi atualizada por último.
const ORDEM_SECOES = [
  PREFIXO_RESUMO,
  PREFIXO_CHECKLIST,
  PREFIXO_ANEXOS,
  PREFIXO_COMENTARIOS,
  PREFIXO_HORAS,
];

function heading(prefixo: string, texto: string) {
  return {
    id: `${prefixo}heading`,
    type: "heading",
    props: { level: 3 },
    content: texto,
  };
}

function linha(prefixo: string, id: string, rotulo: string, valor: string) {
  return {
    id: `${prefixo}${id}`,
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
    heading(PREFIXO_RESUMO, "📋 Resumo da tarefa"),
    linha(PREFIXO_RESUMO, "titulo", "Título", task.title),
  ];

  if (task.description) {
    blocos.push(linha(PREFIXO_RESUMO, "descricao", "Descrição", task.description));
  }

  blocos.push(
    linha(PREFIXO_RESUMO, "status", "Status", statusLabel),
    linha(PREFIXO_RESUMO, "data", "Data", formatarData(task.due_date)),
    linha(
      PREFIXO_RESUMO,
      "horario",
      "Horário",
      task.due_time ? task.due_time.slice(0, 5) : "Sem horário"
    ),
    linha(PREFIXO_RESUMO, "repetir", "Repetir", repeatLabel),
    linha(PREFIXO_RESUMO, "responsavel", "Responsável", responsavelNome),
    linha(PREFIXO_RESUMO, "projeto", "Projeto", projeto ? projeto.name : "Geral"),
    linha(PREFIXO_RESUMO, "cor", "Cor", cor),
    { id: `${PREFIXO_RESUMO}fim`, type: "paragraph" }
  );

  return blocos;
}

// Checklist: usa o bloco nativo de "item com caixinha" do BlockNote, que já
// vem com a marcação de feito/não feito.
export function buildChecklistBlocks(items: ChecklistItem[]) {
  if (items.length === 0) return [];
  const ordenados = [...items].sort((a, b) => a.position - b.position);
  return [
    heading(PREFIXO_CHECKLIST, "✅ Checklist"),
    ...ordenados.map((item) => ({
      id: `${PREFIXO_CHECKLIST}${item.id}`,
      type: "checkListItem",
      props: { checked: item.done },
      content: item.title,
    })),
  ];
}

// Anexos: um link clicável por arquivo, apontando pro mesmo arquivo que já
// tá no Storage (bucket público de anexos de tarefa).
export function buildAnexosBlocks(
  supabase: SupabaseClient,
  attachments: TaskAttachment[]
) {
  if (attachments.length === 0) return [];
  return [
    heading(PREFIXO_ANEXOS, "📎 Anexos"),
    ...attachments.map((anexo) => {
      const { data } = supabase.storage
        .from("task-attachments")
        .getPublicUrl(anexo.file_path);
      return {
        id: `${PREFIXO_ANEXOS}${anexo.id}`,
        type: "paragraph",
        content: [
          {
            type: "link",
            href: data.publicUrl,
            content: [{ type: "text", text: `📎 ${anexo.file_name}`, styles: {} }],
          },
        ],
      };
    }),
  ];
}

// Comentários: quem escreveu em negrito, seguido do texto.
export function buildComentariosBlocks(comments: TaskComment[]) {
  if (comments.length === 0) return [];
  const ordenados = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return [
    heading(PREFIXO_COMENTARIOS, "💬 Comentários"),
    ...ordenados.map((c) => ({
      id: `${PREFIXO_COMENTARIOS}${c.id}`,
      type: "paragraph",
      content: [
        { type: "text", text: `${c.created_by_label || "Alguém"}: `, styles: { bold: true } },
        { type: "text", text: c.content, styles: {} },
      ],
    })),
  ];
}

// Horas: um lançamento por linha, mais uma linha de total no final.
export function buildHorasBlocks(entries: TaskHourEntry[]) {
  if (entries.length === 0) return [];
  const total = entries.reduce((soma, e) => soma + Number(e.hours || 0), 0);
  return [
    heading(PREFIXO_HORAS, "⏱️ Horas"),
    ...entries.map((e) => ({
      id: `${PREFIXO_HORAS}${e.id}`,
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `${e.created_by_label || "Alguém"} — `,
          styles: { bold: true },
        },
        {
          type: "text",
          text: `${e.hours}h${e.note ? " · " + e.note : ""}`,
          styles: {},
        },
      ],
    })),
    {
      id: `${PREFIXO_HORAS}total`,
      type: "paragraph",
      content: [
        { type: "text", text: "Total: ", styles: { bold: true } },
        { type: "text", text: `${total}h`, styles: {} },
      ],
    },
  ];
}

// Troca só os blocos de UMA seção (identificados pelo prefixo no id) dentro
// do conteúdo existente da página, reordenando tudo na ordem certa — as
// outras seções e o que a pessoa escreveu por conta própria continuam lá.
function mesclarSecaoNoConteudo(
  conteudoAtual: unknown,
  prefixoSecao: string,
  blocosNovos: unknown[]
) {
  const atual = Array.isArray(conteudoAtual)
    ? (conteudoAtual as { id?: string }[])
    : [];

  const porPrefixo: Record<string, { id?: string }[]> = {};
  const resto: { id?: string }[] = [];

  atual.forEach((bloco) => {
    const prefixoDoBloco = ORDEM_SECOES.find((p) => bloco?.id?.startsWith(p));
    if (prefixoDoBloco) {
      porPrefixo[prefixoDoBloco] = porPrefixo[prefixoDoBloco] ?? [];
      porPrefixo[prefixoDoBloco].push(bloco);
    } else {
      resto.push(bloco);
    }
  });

  porPrefixo[prefixoSecao] = blocosNovos as { id?: string }[];

  const secoes = ORDEM_SECOES.flatMap((p) => porPrefixo[p] ?? []);
  return [...secoes, ...resto];
}

async function atualizarSecaoNaWiki(
  supabase: SupabaseClient,
  pageId: string,
  prefixoSecao: string,
  blocosNovos: unknown[]
) {
  const { data: pagina } = await supabase
    .from("pages")
    .select("content")
    .eq("id", pageId)
    .maybeSingle();

  const novoConteudo = mesclarSecaoNoConteudo(
    pagina?.content,
    prefixoSecao,
    blocosNovos
  );

  await supabase
    .from("pages")
    .update({ content: novoConteudo, updated_at: new Date().toISOString() })
    .eq("id", pageId);
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
  await atualizarSecaoNaWiki(
    supabase,
    task.page_id,
    PREFIXO_RESUMO,
    buildTaskSummaryBlocks(task, profiles, projects)
  );
}

export async function syncChecklistWiki(
  supabase: SupabaseClient,
  pageId: string | null,
  items: ChecklistItem[]
) {
  if (!pageId) return;
  await atualizarSecaoNaWiki(
    supabase,
    pageId,
    PREFIXO_CHECKLIST,
    buildChecklistBlocks(items)
  );
}

export async function syncAnexosWiki(
  supabase: SupabaseClient,
  pageId: string | null,
  attachments: TaskAttachment[]
) {
  if (!pageId) return;
  await atualizarSecaoNaWiki(
    supabase,
    pageId,
    PREFIXO_ANEXOS,
    buildAnexosBlocks(supabase, attachments)
  );
}

export async function syncComentariosWiki(
  supabase: SupabaseClient,
  pageId: string | null,
  comments: TaskComment[]
) {
  if (!pageId) return;
  await atualizarSecaoNaWiki(
    supabase,
    pageId,
    PREFIXO_COMENTARIOS,
    buildComentariosBlocks(comments)
  );
}

export async function syncHorasWiki(
  supabase: SupabaseClient,
  pageId: string | null,
  entries: TaskHourEntry[]
) {
  if (!pageId) return;
  await atualizarSecaoNaWiki(
    supabase,
    pageId,
    PREFIXO_HORAS,
    buildHorasBlocks(entries)
  );
}
