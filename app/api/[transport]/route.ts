import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarTarefaParaResponsaveis } from "@/lib/push";
import { verificarTokenPessoal, type PerfilAutenticado } from "@/lib/mcp-tokens";
import { podeVerTudo } from "@/lib/permissions";
import {
  resolverProjeto,
  resolverResponsavel,
  proximaPosicao,
  encontrarTarefasPorTitulo,
  projetosVisiveis,
  tarefaEhVisivel,
  urlDoApp,
  STATUS_LABEL,
} from "@/lib/mcp-server-helpers";
import type { ChecklistItem, TaskAttachment, TaskComment, TaskHourEntry, TaskStatus } from "@/lib/types";
import {
  syncAnexosWiki,
  syncChecklistWiki,
  syncComentariosWiki,
  syncHorasWiki,
} from "@/lib/task-wiki-sync";

// Servidor MCP do d.hub — cada pessoa do time gera um token pessoal
// em "Integração com IA" (components/PersonalAiTokens.tsx) e conecta a
// própria IA (Claude Desktop, Claude Code etc.) nessa URL, com esse token
// no cabeçalho Authorization. Daí em diante, pedir pra IA "cria uma tarefa
// no projeto X" já cria de verdade aqui, em nome de quem gerou o token.
//
// Não existe sessão de login normal (cookie) numa chamada de MCP — quem
// chama é a IA de alguém, de fora do navegador. Por isso essa rota usa a
// service_role key (ignora RLS) e faz a autorização na mão: confere o
// token em verificarTokenPessoal() antes de qualquer leitura/escrita, e
// replica as mesmas regras de visibilidade que a pessoa já tem no site
// (ver lib/mcp-server-helpers.ts).

interface ContextoFerramenta {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

function perfilDoContexto(extra: ContextoFerramenta): PerfilAutenticado {
  const info = extra.authInfo?.extra;
  if (!info || typeof info.profileId !== "string") {
    throw new Error("Token inválido ou ausente.");
  }
  return {
    profileId: info.profileId,
    nome: typeof info.nome === "string" ? info.nome : "Alguém",
    username: typeof info.username === "string" ? info.username : null,
  };
}

function mensagemDeErro(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return `Erro: ${msg}`;
}

// Acha UMA tarefa pelo título (e projeto, opcional), respeitando o que a
// pessoa enxerga. Usado pelas ferramentas de checklist.
async function tarefaUnica(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  tarefa: string,
  projeto: string | undefined
): Promise<{ ok: true; id: string; title: string } | { ok: false; erro: string }> {
  const resolProjeto = await resolverProjeto(admin, profileId, projeto);
  if (!resolProjeto.ok) return { ok: false, erro: resolProjeto.erro };

  const candidatas = await encontrarTarefasPorTitulo(
    admin,
    profileId,
    tarefa,
    resolProjeto.projeto?.id ?? null
  );
  if (candidatas.length === 0) {
    return { ok: false, erro: `Não achei nenhuma tarefa com "${tarefa}" no título.` };
  }
  if (candidatas.length > 1) {
    const lista = candidatas.map((t) => `- ${t.title}`).join("\n");
    return {
      ok: false,
      erro: `Mais de uma tarefa bate com "${tarefa}":\n${lista}\nChame de novo com um título mais específico ou informando o projeto.`,
    };
  }
  return { ok: true, id: candidatas[0].id, title: candidatas[0].title };
}

// Mantém a seção "Checklist" da página da tarefa na Wiki igual à aba.
async function sincronizarChecklistNaWiki(admin: ReturnType<typeof createAdminClient>, taskId: string) {
  const [{ data: tarefa }, { data: itens }] = await Promise.all([
    admin.from("tasks").select("page_id").eq("id", taskId).maybeSingle(),
    admin.from("task_checklist_items").select("*").eq("task_id", taskId).order("position"),
  ]);
  await syncChecklistWiki(admin, tarefa?.page_id ?? null, (itens ?? []) as ChecklistItem[]).catch(() => {});
}

function textoDoChecklist(itens: { title: string; done: boolean }[]) {
  const feitos = itens.filter((i) => i.done).length;
  return `Checklist (${feitos}/${itens.length}):\n${itens
    .map((i) => `${i.done ? "[x]" : "[ ]"} ${i.title}`)
    .join("\n")}`;
}

// Tipo do arquivo pelo nome, pro navegador abrir certo depois.
function tipoDoArquivo(nome: string, ehTexto: boolean) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  const tipos: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", md: "text/markdown; charset=utf-8", txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8", json: "application/json", html: "text/html; charset=utf-8",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", mp4: "video/mp4", mp3: "audio/mpeg",
  };
  return tipos[ext] ?? (ehTexto ? "text/plain; charset=utf-8" : "application/octet-stream");
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "now_listar_projetos",
      {
        title: "Listar projetos",
        description: `Lista os projetos do d.hub que essa pessoa enxerga (os que ela criou, os públicos, e aqueles onde ela tem alguma tarefa).

Use isso pra descobrir o nome exato de um projeto antes de criar uma tarefa nele, ou quando alguém perguntar "quais projetos eu tenho".

Args:
  - busca (string, opcional): filtra projetos cujo nome contém esse texto.

Retorna: lista de projetos (nome e id).`,
        inputSchema: {
          busca: z
            .string()
            .max(200)
            .optional()
            .describe("Filtra projetos cujo nome contém esse texto (opcional)."),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ busca }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();
          const todos = await projetosVisiveis(admin, perfil.profileId);
          const filtrados = busca
            ? todos.filter((p) => p.name.toLowerCase().includes(busca.toLowerCase()))
            : todos;

          if (filtrados.length === 0) {
            return { content: [{ type: "text", text: "Nenhum projeto encontrado." }] };
          }

          const texto = filtrados.map((p) => `- ${p.name}`).join("\n");
          return {
            content: [{ type: "text", text: `Projetos (${filtrados.length}):\n${texto}` }],
            structuredContent: { projetos: filtrados },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_criar_tarefa",
      {
        title: "Criar tarefa",
        description: `Cria uma tarefa de verdade no d.hub (aparece na hora no quadro/calendário/wiki de quem for responsável).

Args:
  - titulo (string, obrigatório): nome da tarefa.
  - descricao (string, opcional): detalhes da tarefa. NÃO coloque itens de checklist/lista de passos aqui — use o campo "checklist".
  - checklist (lista de textos, opcional): itens do checklist da tarefa, um por posição (ex: ["Definir o texto", "Montar a arte", "Aprovar com o cliente"]). Sempre que a pessoa pedir checklist, passos, etapas ou itens pra marcar, use ESTE campo — eles vão pra aba "Checklist" da tarefa, onde dá pra marcar cada um como feito.
  - projeto (string, opcional): nome do projeto (ou parte dele). Se não informar, a tarefa entra em "Geral", sem projeto. Use now_listar_projetos se não souber o nome exato.
  - status (string, opcional): um de "todo" (a fazer, padrão), "doing" (em andamento), "done" (concluída), "cancelled" (cancelada).
  - data_prazo (string, opcional): data no formato AAAA-MM-DD.
  - responsavel (string, opcional): nome de quem deve ficar responsável. Aceita "eu"/"mim" pra atribuir a quem pediu a tarefa. Se não informar, a tarefa fica sem responsável.

Retorna: confirmação com o título, projeto e link da tarefa criada.

Erros: se o nome do projeto ou do responsável não for encontrado (ou bater com mais de um), a ferramenta explica o problema e sugere como corrigir — chame de novo com o ajuste.`,
        inputSchema: {
          titulo: z.string().min(1, "Título não pode ser vazio").max(200).describe("Nome da tarefa."),
          descricao: z
            .string()
            .max(5000)
            .optional()
            .describe('Detalhes da tarefa (opcional). Não coloque checklist aqui — use o campo "checklist".'),
          checklist: z
            .array(z.string().min(1).max(300))
            .max(50)
            .optional()
            .describe('Itens do checklist (vão pra aba "Checklist" da tarefa, marcáveis). Use sempre que pedirem checklist, passos ou etapas.'),
          projeto: z
            .string()
            .max(200)
            .optional()
            .describe('Nome do projeto (ou parte dele). Sem isso, vai pra "Geral".'),
          status: z
            .enum(["todo", "doing", "done", "cancelled"])
            .optional()
            .describe('Status inicial (padrão: "todo").'),
          data_prazo: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
            .optional()
            .describe("Data no formato AAAA-MM-DD (opcional)."),
          responsavel: z
            .string()
            .max(200)
            .optional()
            .describe('Nome de quem fica responsável. Aceita "eu"/"mim".'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ titulo, descricao, checklist, projeto, status, data_prazo, responsavel }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
          if (!resolProjeto.ok) {
            return { isError: true, content: [{ type: "text", text: resolProjeto.erro }] };
          }

          const resolResp = await resolverResponsavel(admin, perfil.profileId, responsavel);
          if (!resolResp.ok) {
            return { isError: true, content: [{ type: "text", text: resolResp.erro }] };
          }

          const statusFinal: TaskStatus = (status as TaskStatus) ?? "todo";
          const posicao = await proximaPosicao(admin, statusFinal);

          const { data: tarefa, error } = await admin
            .from("tasks")
            .insert({
              title: titulo.trim(),
              description: descricao?.trim() || null,
              status: statusFinal,
              position: posicao,
              due_date: data_prazo || null,
              project_id: resolProjeto.projeto?.id ?? null,
              assigned_to: resolResp.ids,
              created_by: perfil.profileId,
              created_by_label: `${perfil.nome} (via IA)`,
            })
            .select()
            .single();

          if (error || !tarefa) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Erro ao criar a tarefa: ${error?.message ?? "erro desconhecido"}`,
                },
              ],
            };
          }

          await avisarTarefaParaResponsaveis(tarefa.id, perfil.profileId).catch(() => {});

          const itensChecklist = (checklist ?? []).map((t) => t.trim()).filter(Boolean);
          if (itensChecklist.length > 0) {
            await admin.from("task_checklist_items").insert(
              itensChecklist.map((title, i) => ({ task_id: tarefa.id, title, position: i + 1 }))
            );
          }

          const link = urlDoApp(
            resolProjeto.projeto ? `/projetos/${resolProjeto.projeto.id}` : "/board"
          );
          const nomeProjeto = resolProjeto.projeto?.name ?? "Geral";

          return {
            content: [
              {
                type: "text",
                text: `Tarefa "${tarefa.title}" criada em "${nomeProjeto}" (status: ${
                  STATUS_LABEL[statusFinal]
                })${
                  itensChecklist.length ? `, com ${itensChecklist.length} itens no checklist` : ""
                }. ${link}`,
              },
            ],
            structuredContent: {
              id: tarefa.id,
              title: tarefa.title,
              status: tarefa.status,
              projeto: nomeProjeto,
              due_date: tarefa.due_date,
              url: link,
            },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_listar_tarefas",
      {
        title: "Listar tarefas",
        description: `Lista tarefas do d.hub, com filtros opcionais.

Args:
  - projeto (string, opcional): nome do projeto pra filtrar. Sem isso, lista as tarefas "Geral" (sem projeto) dessa pessoa.
  - status (string, opcional): "todo", "doing", "done" ou "cancelled".
  - responsavel (string, opcional): "eu"/"mim" pra só as tarefas dessa pessoa, ou o nome de alguém do time.
  - limit (number, opcional): máximo de resultados (padrão 20, máximo 50).

Retorna: lista de tarefas com título, status, projeto e prazo.`,
        inputSchema: {
          projeto: z.string().max(200).optional(),
          status: z.enum(["todo", "doing", "done", "cancelled"]).optional(),
          responsavel: z.string().max(200).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ projeto, status, responsavel, limit }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
          if (!resolProjeto.ok) {
            return { isError: true, content: [{ type: "text", text: resolProjeto.erro }] };
          }

          let responsavelId: string | null = null;
          if (responsavel) {
            const resolResp = await resolverResponsavel(admin, perfil.profileId, responsavel);
            if (!resolResp.ok) {
              return { isError: true, content: [{ type: "text", text: resolResp.erro }] };
            }
            responsavelId = resolResp.ids[0] ?? null;
          }

          const verTudo = await podeVerTudo(admin, perfil.profileId);
          const visiveis = await projetosVisiveis(admin, perfil.profileId);
          const idsVisiveis = new Set(visiveis.map((p) => p.id));

          let query = admin
            .from("tasks")
            .select("id, title, status, project_id, due_date, created_by, assigned_to")
            .order("position", { ascending: true })
            .limit(200);

          if (resolProjeto.projeto) {
            query = query.eq("project_id", resolProjeto.projeto.id);
          } else if (!projeto) {
            query = query.is("project_id", null);
            if (!verTudo) {
              query = query.or(
                `created_by.eq.${perfil.profileId},assigned_to.cs.{${perfil.profileId}}`
              );
            }
          }

          if (status) query = query.eq("status", status);

          const { data } = await query;

          let tarefas = (data ?? []).filter((t) =>
            tarefaEhVisivel(
              {
                project_id: t.project_id,
                created_by: t.created_by,
                assigned_to: t.assigned_to ?? [],
              },
              perfil.profileId,
              verTudo,
              idsVisiveis
            )
          );

          if (responsavelId) {
            const idAlvo = responsavelId;
            tarefas = tarefas.filter((t) => (t.assigned_to ?? []).includes(idAlvo));
          }

          const limite = limit ?? 20;
          const total = tarefas.length;
          tarefas = tarefas.slice(0, limite);

          if (tarefas.length === 0) {
            return { content: [{ type: "text", text: "Nenhuma tarefa encontrada com esses filtros." }] };
          }

          const nomesProjetos = new Map(visiveis.map((p) => [p.id, p.name]));
          const linhas = tarefas.map((t) => {
            const proj = t.project_id ? nomesProjetos.get(t.project_id) ?? "?" : "Geral";
            const prazo = t.due_date ? ` — prazo ${t.due_date}` : "";
            const rotulo = STATUS_LABEL[t.status as TaskStatus] ?? t.status;
            return `- [${rotulo}] ${t.title} (${proj})${prazo}`;
          });

          const aviso = total > tarefas.length ? `\n(mostrando ${tarefas.length} de ${total})` : "";

          return {
            content: [{ type: "text", text: linhas.join("\n") + aviso }],
            structuredContent: { total, count: tarefas.length, tarefas },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_atualizar_status_tarefa",
      {
        title: "Atualizar status de uma tarefa",
        description: `Muda o status de uma tarefa já existente (ex: marcar como concluída).

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - novo_status (string, obrigatório): "todo", "doing", "done" ou "cancelled".
  - projeto (string, opcional): nome do projeto, pra ajudar a achar a tarefa certa quando o título é ambíguo.

Retorna: confirmação com o novo status.

Erros: se nenhuma tarefa bater com o título (ou mais de uma bater), a ferramenta lista o que encontrou — chame de novo com um título mais específico ou informando o projeto.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          novo_status: z.enum(["todo", "doing", "done", "cancelled"]).describe("Novo status."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ tarefa, novo_status, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
          if (!resolProjeto.ok) {
            return { isError: true, content: [{ type: "text", text: resolProjeto.erro }] };
          }

          const candidatas = await encontrarTarefasPorTitulo(
            admin,
            perfil.profileId,
            tarefa,
            resolProjeto.projeto?.id ?? null
          );

          if (candidatas.length === 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Não achei nenhuma tarefa com "${tarefa}" no título. Confira o nome ou use now_listar_tarefas.`,
                },
              ],
            };
          }
          if (candidatas.length > 1) {
            const lista = candidatas.map((t) => `- ${t.title}`).join("\n");
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Mais de uma tarefa bate com "${tarefa}":\n${lista}\nChame de novo com um título mais específico ou informando o projeto.`,
                },
              ],
            };
          }

          const alvo = candidatas[0];
          const { error } = await admin
            .from("tasks")
            .update({ status: novo_status })
            .eq("id", alvo.id);

          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao atualizar: ${error.message}` }] };
          }

          return {
            content: [
              { type: "text", text: `Tarefa "${alvo.title}" agora está "${STATUS_LABEL[novo_status]}".` },
            ],
            structuredContent: { id: alvo.id, title: alvo.title, status: novo_status },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_editar_tarefa",
      {
        title: "Editar tarefa",
        description: `Edita uma ou mais informações de uma tarefa já existente — título, descrição, prazo, responsável e/ou status. Só muda o que for informado; o resto continua como está.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa a editar.
  - novo_titulo (string, opcional): novo título da tarefa.
  - descricao (string, opcional): nova descrição (pode mandar vazio "" pra apagar a descrição). Não use a descrição pra checklist, comentários, horas ou anexos — cada um tem a própria ferramenta (now_adicionar_checklist, now_comentar_tarefa, now_registrar_horas, now_anexar_arquivo).
  - data_prazo (string, opcional): nova data no formato AAAA-MM-DD. Pra tirar o prazo, mande "remover" ou "".
  - responsavel (string, opcional): nome de quem deve ficar responsável (aceita "eu"/"mim", e substitui quem já estava). Pra tirar o responsável, mande "remover" ou "ninguém".
  - status (string, opcional): "todo", "doing", "done" ou "cancelled".
  - projeto (string, opcional): nome do projeto, só pra ajudar a achar a tarefa certa quando o título é ambíguo (não move a tarefa de projeto).

Retorna: confirmação com o que foi alterado.

Erros: se nenhuma tarefa bater com o título (ou mais de uma bater), a ferramenta lista o que encontrou — chame de novo com um título mais específico ou informando o projeto. Também dá erro se nenhum campo pra alterar for informado.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa a editar."),
          novo_titulo: z.string().min(1).max(200).optional().describe("Novo título da tarefa."),
          descricao: z
            .string()
            .max(5000)
            .optional()
            .describe('Nova descrição. Mande "" pra apagar.'),
          data_prazo: z
            .string()
            .max(20)
            .optional()
            .describe('Nova data no formato AAAA-MM-DD. Mande "remover" ou "" pra tirar o prazo.'),
          responsavel: z
            .string()
            .max(200)
            .optional()
            .describe('Nome de quem fica responsável (substitui). Aceita "eu"/"mim". Mande "remover" pra tirar.'),
          status: z.enum(["todo", "doing", "done", "cancelled"]).optional().describe("Novo status."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (
        { tarefa, novo_titulo, descricao, data_prazo, responsavel, status, projeto },
        extra
      ) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
          if (!resolProjeto.ok) {
            return { isError: true, content: [{ type: "text", text: resolProjeto.erro }] };
          }

          const atualizacoes: Record<string, unknown> = {};
          const resumo: string[] = [];

          if (novo_titulo !== undefined) {
            atualizacoes.title = novo_titulo.trim();
            resumo.push(`título → "${novo_titulo.trim()}"`);
          }

          if (descricao !== undefined) {
            atualizacoes.description = descricao.trim() || null;
            resumo.push(descricao.trim() ? "descrição atualizada" : "descrição removida");
          }

          if (data_prazo !== undefined) {
            const normalizado = data_prazo.trim().toLowerCase();
            if (normalizado === "" || ["remover", "nenhuma", "sem prazo", "sem data"].includes(normalizado)) {
              atualizacoes.due_date = null;
              resumo.push("prazo removido");
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(data_prazo.trim())) {
              atualizacoes.due_date = data_prazo.trim();
              resumo.push(`prazo → ${data_prazo.trim()}`);
            } else {
              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Data inválida: "${data_prazo}". Use o formato AAAA-MM-DD, ou "remover" pra tirar o prazo.`,
                  },
                ],
              };
            }
          }

          if (responsavel !== undefined) {
            const normalizado = responsavel.trim().toLowerCase();
            if (["remover", "ninguém", "ninguem", "nenhum", "sem responsável", "sem responsavel"].includes(normalizado)) {
              atualizacoes.assigned_to = [];
              resumo.push("responsável removido");
            } else {
              const resolResp = await resolverResponsavel(admin, perfil.profileId, responsavel);
              if (!resolResp.ok) {
                return { isError: true, content: [{ type: "text", text: resolResp.erro }] };
              }
              atualizacoes.assigned_to = resolResp.ids;
              resumo.push(`responsável → ${responsavel.trim()}`);
            }
          }

          if (status !== undefined) {
            atualizacoes.status = status;
            resumo.push(`status → ${STATUS_LABEL[status as TaskStatus]}`);
          }

          if (Object.keys(atualizacoes).length === 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "Nada pra atualizar. Informe ao menos um campo: novo_titulo, descricao, data_prazo, responsavel ou status.",
                },
              ],
            };
          }

          const candidatas = await encontrarTarefasPorTitulo(
            admin,
            perfil.profileId,
            tarefa,
            resolProjeto.projeto?.id ?? null
          );

          if (candidatas.length === 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Não achei nenhuma tarefa com "${tarefa}" no título. Confira o nome ou use now_listar_tarefas.`,
                },
              ],
            };
          }
          if (candidatas.length > 1) {
            const lista = candidatas.map((t) => `- ${t.title}`).join("\n");
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Mais de uma tarefa bate com "${tarefa}":\n${lista}\nChame de novo com um título mais específico ou informando o projeto.`,
                },
              ],
            };
          }

          const alvo = candidatas[0];
          const { error } = await admin.from("tasks").update(atualizacoes).eq("id", alvo.id);

          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao atualizar: ${error.message}` }] };
          }

          const tituloFinal = (atualizacoes.title as string | undefined) ?? alvo.title;

          return {
            content: [
              {
                type: "text",
                text: `Tarefa "${tituloFinal}" atualizada: ${resumo.join(", ")}.`,
              },
            ],
            structuredContent: { id: alvo.id, title: tituloFinal, alteracoes: resumo },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_comentar_tarefa",
      {
        title: "Comentar numa tarefa",
        description: `Adiciona um comentário numa tarefa já existente (aparece na aba "Comentários" dela). Use esta ferramenta pra recados, atualizações e observações sobre a tarefa — não escreva comentários na descrição.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - comentario (string, obrigatório): texto do comentário.
  - projeto (string, opcional): nome do projeto, pra ajudar a achar a tarefa certa quando o título é ambíguo.

Retorna: confirmação.

Erros: se nenhuma tarefa bater com o título (ou mais de uma bater), a ferramenta lista o que encontrou.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          comentario: z.string().min(1).max(5000).describe("Texto do comentário."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ tarefa, comentario, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
          if (!resolProjeto.ok) {
            return { isError: true, content: [{ type: "text", text: resolProjeto.erro }] };
          }

          const candidatas = await encontrarTarefasPorTitulo(
            admin,
            perfil.profileId,
            tarefa,
            resolProjeto.projeto?.id ?? null
          );

          if (candidatas.length === 0) {
            return {
              isError: true,
              content: [{ type: "text", text: `Não achei nenhuma tarefa com "${tarefa}" no título.` }],
            };
          }
          if (candidatas.length > 1) {
            const lista = candidatas.map((t) => `- ${t.title}`).join("\n");
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Mais de uma tarefa bate com "${tarefa}":\n${lista}\nChame de novo com um título mais específico ou informando o projeto.`,
                },
              ],
            };
          }

          const alvo = candidatas[0];
          const linha = {
            task_id: alvo.id,
            content: comentario.trim(),
            created_by_label: `${perfil.nome} (via IA)`,
          };
          // created_by (migration 0039) deixa o autor editar/excluir depois;
          // sem a migration, grava sem ele.
          let { error } = await admin.from("task_comments").insert({ ...linha, created_by: perfil.profileId });
          if (error && error.message.includes("created_by")) {
            ({ error } = await admin.from("task_comments").insert(linha));
          }

          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao comentar: ${error.message}` }] };
          }

          // Mantém a seção de comentários da página na Wiki atualizada.
          const [{ data: tarefaRow }, { data: comentarios }] = await Promise.all([
            admin.from("tasks").select("page_id").eq("id", alvo.id).maybeSingle(),
            admin.from("task_comments").select("*").eq("task_id", alvo.id).order("created_at"),
          ]);
          await syncComentariosWiki(admin, tarefaRow?.page_id ?? null, (comentarios ?? []) as TaskComment[]).catch(() => {});

          return {
            content: [{ type: "text", text: `Comentário adicionado em "${alvo.title}".` }],
            structuredContent: { taskId: alvo.id, title: alvo.title },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_adicionar_checklist",
      {
        title: "Adicionar itens ao checklist",
        description: `Adiciona itens ao checklist de uma tarefa que já existe (aba "Checklist", onde cada item pode ser marcado como feito).

Use SEMPRE esta ferramenta quando a pessoa pedir pra colocar itens, passos ou etapas num checklist de uma tarefa existente — nunca escreva esses itens na descrição. Pra uma tarefa nova, use o campo "checklist" do now_criar_tarefa.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - itens (lista de textos, obrigatório): itens a adicionar, na ordem.
  - projeto (string, opcional): nome do projeto, pra achar a tarefa certa quando o título é ambíguo.

Retorna: o checklist completo atualizado.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          itens: z
            .array(z.string().min(1).max(300))
            .min(1)
            .max(50)
            .describe("Itens do checklist, na ordem."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ tarefa, itens, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();
          const alvo = await tarefaUnica(admin, perfil.profileId, tarefa, projeto);
          if (!alvo.ok) return { isError: true, content: [{ type: "text", text: alvo.erro }] };

          const { data: existentes } = await admin
            .from("task_checklist_items")
            .select("position")
            .eq("task_id", alvo.id);
          const maior = (existentes ?? []).reduce((m, i) => Math.max(m, i.position as number), 0);

          const novos = itens.map((t) => t.trim()).filter(Boolean);
          const { error } = await admin.from("task_checklist_items").insert(
            novos.map((title, i) => ({ task_id: alvo.id, title, position: maior + i + 1 }))
          );
          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao adicionar: ${error.message}` }] };
          }

          await sincronizarChecklistNaWiki(admin, alvo.id);
          const { data: todos } = await admin
            .from("task_checklist_items")
            .select("title, done")
            .eq("task_id", alvo.id)
            .order("position");

          return {
            content: [
              {
                type: "text",
                text: `${novos.length} ${novos.length === 1 ? "item adicionado" : "itens adicionados"} ao checklist de "${alvo.title}".\n${textoDoChecklist(todos ?? [])}`,
              },
            ],
            structuredContent: { taskId: alvo.id, title: alvo.title, checklist: todos ?? [] },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_marcar_checklist",
      {
        title: "Marcar item do checklist",
        description: `Marca (ou desmarca) um item do checklist de uma tarefa como feito.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - item (string, obrigatório): texto (ou parte do texto) do item do checklist.
  - feito (boolean, opcional): true pra marcar como feito (padrão), false pra desmarcar.
  - projeto (string, opcional): nome do projeto, pra desambiguar.

Retorna: o checklist atualizado. Se o item não for encontrado (ou bater com mais de um), lista os itens da tarefa.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          item: z.string().min(1).max(300).describe("Texto (ou parte do texto) do item."),
          feito: z.boolean().optional().describe("true = feito (padrão); false = desmarcar."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ tarefa, item, feito, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();
          const alvo = await tarefaUnica(admin, perfil.profileId, tarefa, projeto);
          if (!alvo.ok) return { isError: true, content: [{ type: "text", text: alvo.erro }] };

          const { data: todos } = await admin
            .from("task_checklist_items")
            .select("id, title, done")
            .eq("task_id", alvo.id)
            .order("position");
          const lista = todos ?? [];
          const termo = item.trim().toLowerCase();
          const achados = lista.filter((i) => (i.title as string).toLowerCase().includes(termo));

          if (achados.length !== 1) {
            const motivo =
              achados.length === 0
                ? `Não achei nenhum item com "${item}" no checklist de "${alvo.title}".`
                : `Mais de um item bate com "${item}". Use um texto mais específico.`;
            return {
              isError: true,
              content: [{ type: "text", text: `${motivo}\n${lista.length ? textoDoChecklist(lista) : "A tarefa não tem checklist."}` }],
            };
          }

          const novoValor = feito ?? true;
          await admin.from("task_checklist_items").update({ done: novoValor }).eq("id", achados[0].id);
          await sincronizarChecklistNaWiki(admin, alvo.id);
          const atualizados = lista.map((i) => (i.id === achados[0].id ? { ...i, done: novoValor } : i));

          return {
            content: [
              {
                type: "text",
                text: `"${achados[0].title}" ${novoValor ? "marcado como feito" : "desmarcado"}.\n${textoDoChecklist(atualizados)}`,
              },
            ],
            structuredContent: { taskId: alvo.id, checklist: atualizados },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_registrar_horas",
      {
        title: "Registrar horas numa tarefa",
        description: `Lança horas trabalhadas numa tarefa (aba "Horas"). As horas entram no Painel de quem pediu.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - horas (número, obrigatório): quantidade de horas, ex: 1.5 pra 1h30.
  - nota (string, opcional): o que foi feito nesse tempo.
  - projeto (string, opcional): nome do projeto, pra desambiguar.

Retorna: confirmação com o total de horas da tarefa.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          horas: z.number().positive().max(24).describe("Horas trabalhadas (ex: 1.5 = 1h30)."),
          nota: z.string().max(500).optional().describe("O que foi feito (opcional)."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ tarefa, horas, nota, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();
          const alvo = await tarefaUnica(admin, perfil.profileId, tarefa, projeto);
          if (!alvo.ok) return { isError: true, content: [{ type: "text", text: alvo.erro }] };

          // Mesmo rótulo que a tela usa (o usuário de login), pra as horas
          // contarem no Painel da pessoa.
          const { error } = await admin.from("task_hours").insert({
            task_id: alvo.id,
            hours: horas,
            note: nota?.trim() || null,
            created_by_label: perfil.username ?? perfil.nome,
          });
          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao lançar horas: ${error.message}` }] };
          }

          const [{ data: tarefaRow }, { data: lancamentos }] = await Promise.all([
            admin.from("tasks").select("page_id").eq("id", alvo.id).maybeSingle(),
            admin.from("task_hours").select("*").eq("task_id", alvo.id).order("created_at", { ascending: false }),
          ]);
          await syncHorasWiki(admin, tarefaRow?.page_id ?? null, (lancamentos ?? []) as TaskHourEntry[]).catch(() => {});
          const total = (lancamentos ?? []).reduce((s, l) => s + Number(l.hours), 0);

          return {
            content: [
              {
                type: "text",
                text: `${horas.toLocaleString("pt-BR")}h lançadas em "${alvo.title}". Total da tarefa: ${total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h.`,
              },
            ],
            structuredContent: { taskId: alvo.id, horas, total },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );

    server.registerTool(
      "now_anexar_arquivo",
      {
        title: "Anexar arquivo numa tarefa",
        description: `Anexa um arquivo numa tarefa (aba "Anexos").

Mande o conteúdo de UM destes jeitos:
  - conteudo_texto: pra arquivos de texto que você mesmo gerou (roteiro, briefing, lista, .md, .txt, .csv...).
  - conteudo_base64: pra arquivos binários (PDF, imagem, planilha), com os bytes em base64.
Limite: 10 MB.

Args:
  - tarefa (string, obrigatório): título (ou parte do título) da tarefa.
  - nome_arquivo (string, obrigatório): nome com extensão, ex: "briefing.md" ou "proposta.pdf".
  - conteudo_texto (string, opcional): conteúdo em texto.
  - conteudo_base64 (string, opcional): conteúdo binário em base64.
  - projeto (string, opcional): nome do projeto, pra desambiguar.

Retorna: confirmação com o link do arquivo.`,
        inputSchema: {
          tarefa: z.string().min(1).max(200).describe("Título (ou parte do título) da tarefa."),
          nome_arquivo: z.string().min(1).max(200).describe('Nome do arquivo com extensão (ex: "briefing.md").'),
          conteudo_texto: z.string().max(2_000_000).optional().describe("Conteúdo em texto (arquivos de texto)."),
          conteudo_base64: z.string().max(14_000_000).optional().describe("Conteúdo binário em base64 (PDF, imagem...)."),
          projeto: z.string().max(200).optional().describe("Nome do projeto, pra desambiguar (opcional)."),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ tarefa, nome_arquivo, conteudo_texto, conteudo_base64, projeto }, extra) => {
        try {
          const perfil = perfilDoContexto(extra as ContextoFerramenta);
          const admin = createAdminClient();

          if ((conteudo_texto == null) === (conteudo_base64 == null)) {
            return {
              isError: true,
              content: [{ type: "text", text: 'Mande o conteúdo em "conteudo_texto" OU em "conteudo_base64" (um dos dois).' }],
            };
          }

          const alvo = await tarefaUnica(admin, perfil.profileId, tarefa, projeto);
          if (!alvo.ok) return { isError: true, content: [{ type: "text", text: alvo.erro }] };

          const bytes =
            conteudo_texto != null
              ? Buffer.from(conteudo_texto, "utf-8")
              : Buffer.from(conteudo_base64 as string, "base64");
          if (bytes.length === 0) {
            return { isError: true, content: [{ type: "text", text: "O arquivo está vazio." }] };
          }
          if (bytes.length > 10 * 1024 * 1024) {
            return { isError: true, content: [{ type: "text", text: "O arquivo passa de 10 MB." }] };
          }

          const nome = nome_arquivo.trim();
          const seguro =
            nome
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .replace(/[^a-zA-Z0-9._-]+/g, "-")
              .slice(-100) || "arquivo";
          const caminho = `${alvo.id}/${Date.now()}-${seguro}`;
          const { error: erroUpload } = await admin.storage
            .from("task-attachments")
            .upload(caminho, bytes, { contentType: tipoDoArquivo(nome, conteudo_texto != null) });
          if (erroUpload) {
            return { isError: true, content: [{ type: "text", text: `Erro ao enviar o arquivo: ${erroUpload.message}` }] };
          }

          const { error } = await admin.from("task_attachments").insert({
            task_id: alvo.id,
            file_name: nome,
            file_path: caminho,
            uploaded_by_label: `${perfil.nome} (via IA)`,
          });
          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao registrar o anexo: ${error.message}` }] };
          }

          const [{ data: tarefaRow }, { data: anexos }] = await Promise.all([
            admin.from("tasks").select("page_id").eq("id", alvo.id).maybeSingle(),
            admin.from("task_attachments").select("*").eq("task_id", alvo.id).order("created_at"),
          ]);
          await syncAnexosWiki(admin, tarefaRow?.page_id ?? null, (anexos ?? []) as TaskAttachment[]).catch(() => {});
          const url = admin.storage.from("task-attachments").getPublicUrl(caminho).data.publicUrl;

          return {
            content: [{ type: "text", text: `Arquivo "${nome}" anexado em "${alvo.title}". ${url}` }],
            structuredContent: { taskId: alvo.id, arquivo: nome, url },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: mensagemDeErro(error) }] };
        }
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const perfil = await verificarTokenPessoal(bearerToken);
  if (!perfil) return undefined;

  return {
    token: bearerToken,
    scopes: ["now_organiza"],
    clientId: perfil.profileId,
    extra: {
      profileId: perfil.profileId,
      nome: perfil.nome,
      username: perfil.username,
    },
  };
};

// resourceMetadataPath: no 401, aponta pros metadados OAuth deste recurso —
// é por ali que o ChatGPT descobre como fazer login (ver lib/oauth.ts).
// Quem conecta com o token no cabeçalho (Claude) nem passa por isso.
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST };
