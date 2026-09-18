import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createAdminClient } from "@/lib/supabase/admin";
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
import type { TaskStatus } from "@/lib/types";

// Servidor MCP do Now Organiza — cada pessoa do time gera um token pessoal
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

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "now_listar_projetos",
      {
        title: "Listar projetos",
        description: `Lista os projetos do Now Organiza que essa pessoa enxerga (os que ela criou, os públicos, e aqueles onde ela tem alguma tarefa).

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
        description: `Cria uma tarefa de verdade no Now Organiza (aparece na hora no quadro/calendário/wiki de quem for responsável).

Args:
  - titulo (string, obrigatório): nome da tarefa.
  - descricao (string, opcional): detalhes da tarefa.
  - projeto (string, opcional): nome do projeto (ou parte dele). Se não informar, a tarefa entra em "Geral", sem projeto. Use now_listar_projetos se não souber o nome exato.
  - status (string, opcional): um de "todo" (a fazer, padrão), "doing" (em andamento), "done" (concluída), "cancelled" (cancelada).
  - data_prazo (string, opcional): data no formato AAAA-MM-DD.
  - responsavel (string, opcional): nome de quem deve ficar responsável. Aceita "eu"/"mim" pra atribuir a quem pediu a tarefa. Se não informar, a tarefa fica sem responsável.

Retorna: confirmação com o título, projeto e link da tarefa criada.

Erros: se o nome do projeto ou do responsável não for encontrado (ou bater com mais de um), a ferramenta explica o problema e sugere como corrigir — chame de novo com o ajuste.`,
        inputSchema: {
          titulo: z.string().min(1, "Título não pode ser vazio").max(200).describe("Nome da tarefa."),
          descricao: z.string().max(5000).optional().describe("Detalhes da tarefa (opcional)."),
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
      async ({ titulo, descricao, projeto, status, data_prazo, responsavel }, extra) => {
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
                }). ${link}`,
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
        description: `Lista tarefas do Now Organiza, com filtros opcionais.

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
      "now_comentar_tarefa",
      {
        title: "Comentar numa tarefa",
        description: `Adiciona um comentário numa tarefa já existente (aparece na aba "Comentários" dela).

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
          const { error } = await admin.from("task_comments").insert({
            task_id: alvo.id,
            content: comentario.trim(),
            created_by_label: `${perfil.nome} (via IA)`,
          });

          if (error) {
            return { isError: true, content: [{ type: "text", text: `Erro ao comentar: ${error.message}` }] };
          }

          return {
            content: [{ type: "text", text: `Comentário adicionado em "${alvo.title}".` }],
            structuredContent: { taskId: alvo.id, title: alvo.title },
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

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
});

export { authHandler as GET, authHandler as POST };
