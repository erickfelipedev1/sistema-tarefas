import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeVerTudo } from "@/lib/permissions";
import {
  encontrarTarefasPorTitulo,
  hojeEmSP,
  htmlEmTexto,
  mensagemDeErro,
  perfilDoContexto,
  projetosVisiveis,
  resolverProjeto,
  STATUS_LABEL,
  tarefaEhVisivel,
  urlDoApp,
  type ContextoFerramenta,
} from "@/lib/mcp-server-helpers";
import type { TaskStatus } from "@/lib/types";

// Ferramentas só de leitura do MCP pro agente (Claude/ChatGPT conectado ao
// d.hub) entender o trabalho: a tarefa inteira, os posts, as atas e os
// projetos de cada cliente. Mesma visibilidade da pessoa no site.

type Admin = ReturnType<typeof createAdminClient>;

const LEITURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const STATUS_DO_POST: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado pro cliente",
  ajuste: "Cliente pediu ajuste",
  publicado: "Aprovado",
};

const STATUS_DO_PROJETO: Record<string, string> = { ativo: "Em andamento", pausado: "Pausado", concluido: "Concluído" };

function erro(texto: string) {
  return { isError: true, content: [{ type: "text" as const, text: texto }] };
}

function texto(t: string, estruturado?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: t }], ...(estruturado ? { structuredContent: estruturado } : {}) };
}

function diasAPartirDeHoje(dias: number) {
  const d = new Date(`${hojeEmSP()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Atas internas (sem cliente) + as dos clientes que a pessoa vê, já na consulta.
function soAtasVisiveis<Q extends { or: (filtro: string) => Q }>(q: Q, verTudo: boolean, ids: Set<string>): Q {
  if (verTudo) return q;
  return q.or(ids.size ? `project_id.is.null,project_id.in.(${Array.from(ids).join(",")})` : "project_id.is.null");
}

function corta(t: string, limite: number) {
  return t.length > limite ? `${t.slice(0, limite)}… (cortado)` : t;
}

async function nomesDasPessoas(admin: Admin) {
  const { data } = await admin.from("profiles").select("id, name, username");
  return new Map((data ?? []).map((p) => [p.id as string, (p.name || p.username || "?") as string]));
}

async function contexto(admin: Admin, profileId: string) {
  const [verTudo, visiveis] = await Promise.all([podeVerTudo(admin, profileId), projetosVisiveis(admin, profileId)]);
  return { verTudo, visiveis, idsVisiveis: new Set(visiveis.map((p) => p.id)), nomeDoCliente: new Map(visiveis.map((p) => [p.id, p.name])) };
}

export function registrarFerramentasDeLeitura(server: McpServer) {
  server.registerTool(
    "now_ver_tarefa",
    {
      title: "Ver tarefa completa",
      description: `Mostra tudo de UMA tarefa: cliente, projeto do cliente, status, período, responsáveis, etiquetas, descrição, checklist, subtarefas e os últimos comentários.

Use antes de editar, resumir ou responder perguntas sobre uma tarefa específica.

Args:
  - tarefa (string, obrigatório): título (ou parte do título).
  - projeto (string, opcional): nome do cliente, pra desambiguar.`,
      inputSchema: {
        tarefa: z.string().min(1).max(200),
        projeto: z.string().max(200).optional(),
      },
      annotations: LEITURA,
    },
    async ({ tarefa, projeto }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();
        const resol = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resol.ok) return erro(resol.erro);
        let candidatas = await encontrarTarefasPorTitulo(admin, perfil.profileId, tarefa, resol.projeto?.id ?? null);
        const exatas = candidatas.filter((t) => t.title.trim().toLowerCase() === tarefa.trim().toLowerCase());
        if (exatas.length === 1) candidatas = exatas;
        if (candidatas.length === 0) return erro(`Não achei nenhuma tarefa com "${tarefa}" no título.`);
        if (candidatas.length > 1) {
          return erro(`Mais de uma tarefa bate com "${tarefa}":\n${candidatas.map((t) => `- ${t.title}`).join("\n")}\nChame de novo com um título mais específico ou informando o cliente.`);
        }
        const id = candidatas[0].id;

        const [{ data: t }, { data: itens }, { data: filhas }, { data: comentarios }, { data: ligacoes }, nomes] = await Promise.all([
          admin.from("tasks").select("*").eq("id", id).single(),
          admin.from("task_checklist_items").select("title, done").eq("task_id", id).order("position"),
          admin.from("tasks").select("title, status, due_date").eq("parent_id", id).order("created_at"),
          admin.from("task_comments").select("content, created_by_label, created_at").eq("task_id", id).order("created_at", { ascending: false }).limit(10),
          admin.from("task_label_links").select("task_labels(name)").eq("task_id", id),
          nomesDasPessoas(admin),
        ]);
        if (!t) return erro("Não deu pra ler a tarefa.");

        const [{ data: cliente }, { data: sub }, { data: mae }] = await Promise.all([
          t.project_id ? admin.from("projects").select("name").eq("id", t.project_id).maybeSingle() : Promise.resolve({ data: null }),
          t.subproject_id ? admin.from("subprojects").select("name").eq("id", t.subproject_id).maybeSingle() : Promise.resolve({ data: null }),
          t.parent_id
            ? admin.from("tasks").select("title, project_id, created_by, assigned_to").eq("id", t.parent_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        // O título da principal só aparece se a pessoa também enxerga a principal.
        let paiVisivel = false;
        if (mae) {
          const ctx = await contexto(admin, perfil.profileId);
          paiVisivel = tarefaEhVisivel(
            { project_id: mae.project_id, created_by: mae.created_by, assigned_to: mae.assigned_to ?? [] },
            perfil.profileId,
            ctx.verTudo,
            ctx.idsVisiveis
          );
        }

        const hoje = hojeEmSP();
        const atrasada = t.due_date && t.due_date < hoje && t.status !== "done" && t.status !== "cancelled";
        const etiquetas = (ligacoes ?? [])
          .map((l) => (l as unknown as { task_labels: { name: string } | null }).task_labels?.name)
          .filter(Boolean);
        const descricao = t.description || htmlEmTexto(t.description_html);
        const linhas = [
          `Tarefa: ${t.title}`,
          `Cliente: ${cliente?.name ?? "Geral (sem cliente)"}`,
          sub ? `Projeto do cliente: ${sub.name}` : null,
          mae ? `Subtarefa de: ${paiVisivel ? mae.title : "(uma tarefa que você não vê)"}` : null,
          `Status: ${STATUS_LABEL[t.status as TaskStatus] ?? t.status}${atrasada ? " (ATRASADA)" : ""}`,
          `Período: ${t.start_date ?? "?"} → ${t.due_date ?? "sem prazo"}${t.due_time ? ` às ${String(t.due_time).slice(0, 5)}` : ""}`,
          `Responsáveis: ${((t.assigned_to as string[]) ?? []).map((p) => nomes.get(p) ?? "?").join(", ") || "ninguém"}`,
          `Criada por: ${t.created_by_label ?? "?"} em ${String(t.created_at).slice(0, 10)}`,
          etiquetas.length ? `Etiquetas: ${etiquetas.join(", ")}` : null,
          "",
          `Descrição:\n${descricao ? corta(descricao, 6000) : "(vazia)"}`,
          t.copy_text ? `\nCopy:\n${corta(t.copy_text, 3000)}` : null,
          (itens ?? []).length
            ? `\nChecklist (${(itens ?? []).filter((i) => i.done).length}/${(itens ?? []).length}):\n${(itens ?? []).map((i) => `${i.done ? "[x]" : "[ ]"} ${i.title}`).join("\n")}`
            : null,
          (filhas ?? []).length
            ? `\nSubtarefas:\n${(filhas ?? []).map((f) => `- [${STATUS_LABEL[f.status as TaskStatus] ?? f.status}] ${f.title}${f.due_date ? ` — ${f.due_date}` : ""}`).join("\n")}`
            : null,
          (comentarios ?? []).length
            ? `\nÚltimos comentários (mais novo primeiro):\n${(comentarios ?? []).map((c) => `- ${c.created_by_label ?? "?"} (${String(c.created_at).slice(0, 10)}): ${corta(c.content, 600)}`).join("\n")}`
            : null,
          `\nLink: ${urlDoApp(`/board?tarefa=${t.id}`)}`,
        ];
        return texto(linhas.filter((l) => l !== null).join("\n"), { id: t.id, title: t.title, status: t.status });
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_listar_projetos_do_cliente",
    {
      title: "Listar projetos de um cliente",
      description: `Lista os projetos de um cliente (frentes de trabalho como "Site novo", "Campanha de Natal") com status, período e andamento das tarefas ligadas.

Args:
  - projeto (string, obrigatório): nome do cliente.
  - com_concluidos (boolean, opcional): incluir os projetos concluídos (padrão: não).`,
      inputSchema: {
        projeto: z.string().min(1).max(200),
        com_concluidos: z.boolean().optional(),
      },
      annotations: LEITURA,
    },
    async ({ projeto, com_concluidos }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();
        const resol = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resol.ok) return erro(resol.erro);
        if (!resol.projeto) return erro("Informe o cliente.");
        const [{ data: subs, error: e1 }, { data: tarefas }] = await Promise.all([
          admin.from("subprojects").select("*").eq("project_id", resol.projeto.id).order("created_at"),
          admin.from("tasks").select("status, due_date, subproject_id").eq("project_id", resol.projeto.id).not("subproject_id", "is", null),
        ]);
        if (e1) return erro("Os projetos do cliente ainda não estão disponíveis.");
        const lista = (subs ?? []).filter((s) => com_concluidos || s.status !== "concluido");
        if (lista.length === 0) return texto(`${resol.projeto.name} não tem projetos${com_concluidos ? "" : " em andamento"}.`);
        const hoje = hojeEmSP();
        const linhas = lista.map((s) => {
          const ts = (tarefas ?? []).filter((t) => t.subproject_id === s.id && t.status !== "cancelled");
          const feitas = ts.filter((t) => t.status === "done").length;
          const atrasadas = ts.filter((t) => t.status !== "done" && t.due_date && t.due_date < hoje).length;
          const periodo = s.due_date ? ` — entrega ${s.due_date}` : "";
          return `- ${s.name} [${STATUS_DO_PROJETO[s.status] ?? s.status}]${periodo}: ${feitas}/${ts.length} tarefas concluídas${atrasadas ? `, ${atrasadas} atrasada(s)` : ""}${s.description ? `\n  ${corta(s.description, 300)}` : ""}`;
        });
        return texto(`Projetos de ${resol.projeto.name}:\n${linhas.join("\n")}`);
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_listar_posts",
    {
      title: "Listar posts",
      description: `Lista os posts do calendário de postagem (os que vão pro cliente aprovar), com data, formato, redes, status e o começo da legenda.

Args:
  - projeto (string, opcional): nome do cliente. Sem isso, lista de todos os clientes que a pessoa enxerga.
  - status (string, opcional): "rascunho", "enviado" (aguardando o cliente), "ajuste" (cliente pediu ajuste) ou "publicado" (aprovado).
  - de, ate (string, opcional): intervalo de datas de postagem, AAAA-MM-DD.
  - limit (number, opcional): padrão 30, máximo 100.`,
      inputSchema: {
        projeto: z.string().max(200).optional(),
        status: z.enum(["rascunho", "enviado", "ajuste", "publicado"]).optional(),
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: LEITURA,
    },
    async ({ projeto, status, de, ate, limit }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();
        const resol = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resol.ok) return erro(resol.erro);
        const ctx = await contexto(admin, perfil.profileId);
        let q = admin
          .from("posts")
          .select("id, project_id, category, networks, scheduled_date, status, caption, created_by_label")
          .order("scheduled_date", { ascending: true, nullsFirst: false })
          .limit(300);
        if (resol.projeto) q = q.eq("project_id", resol.projeto.id);
        else if (!ctx.verTudo) {
          if (ctx.idsVisiveis.size === 0) return texto("Nenhum post encontrado com esses filtros.");
          q = q.in("project_id", Array.from(ctx.idsVisiveis));
        }
        if (status) q = q.eq("status", status);
        // Sem período nem status: dos últimos 7 dias pra frente (não o histórico todo).
        const inicio = de ?? (!ate && !status ? diasAPartirDeHoje(-7) : undefined);
        if (inicio) q = q.gte("scheduled_date", inicio);
        if (ate) q = q.lte("scheduled_date", ate);
        const { data } = await q;
        const posts = (data ?? []).filter((p) => ctx.verTudo || ctx.idsVisiveis.has(p.project_id));
        const limite = limit ?? 30;
        if (posts.length === 0) return texto("Nenhum post encontrado com esses filtros.");
        const linhas = posts.slice(0, limite).map((p) => {
          const legenda = (p.caption ?? "").replace(/\s+/g, " ").trim();
          return `- ${p.scheduled_date ?? "sem data"} · ${ctx.nomeDoCliente.get(p.project_id) ?? "?"} · ${p.category} (${((p.networks as string[]) ?? []).join(", ")}) · ${STATUS_DO_POST[p.status] ?? p.status}${legenda ? ` — "${corta(legenda, 140)}"` : ""}`;
        });
        const aviso = posts.length > limite ? `\n(mostrando ${limite} de ${posts.length})` : "";
        return texto(linhas.join("\n") + aviso, { total: posts.length });
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_listar_atas",
    {
      title: "Listar atas de reunião",
      description: `Lista as atas de reunião (mais recentes primeiro), com data, cliente e título.

Args:
  - projeto (string, opcional): nome do cliente. Sem isso, lista de todos (inclusive reuniões internas).
  - busca (string, opcional): texto no título.
  - limit (number, opcional): padrão 20, máximo 50.`,
      inputSchema: {
        projeto: z.string().max(200).optional(),
        busca: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: LEITURA,
    },
    async ({ projeto, busca, limit }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();
        const resol = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resol.ok) return erro(resol.erro);
        const ctx = await contexto(admin, perfil.profileId);
        let q = admin
          .from("atas")
          .select("id, project_id, title, meeting_date, start_time, transcricao_status")
          .order("meeting_date", { ascending: false })
          .limit(200);
        if (resol.projeto) q = q.eq("project_id", resol.projeto.id);
        else q = soAtasVisiveis(q, ctx.verTudo, ctx.idsVisiveis);
        if (busca) q = q.ilike("title", `%${busca}%`);
        const { data, error } = await q;
        if (error) return erro("As atas ainda não estão disponíveis.");
        const atas = (data ?? []).filter((a) => !a.project_id || ctx.verTudo || ctx.idsVisiveis.has(a.project_id));
        if (atas.length === 0) return texto("Nenhuma ata encontrada.");
        const limite = limit ?? 20;
        const linhas = atas.slice(0, limite).map(
          (a) =>
            `- ${a.meeting_date}${a.start_time ? ` ${String(a.start_time).slice(0, 5)}` : ""} · ${a.project_id ? ctx.nomeDoCliente.get(a.project_id) ?? "?" : "Interna"} · ${a.title}${a.transcricao_status === "pronta" ? " (com transcrição)" : ""}`
        );
        return texto(linhas.join("\n") + (atas.length > limite ? `\n(mostrando ${limite} de ${atas.length})` : ""));
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_ver_ata",
    {
      title: "Ver ata de reunião",
      description: `Mostra uma ata inteira: data, participantes, pauta, decisões e próximos passos (e, se pedir, a transcrição da gravação).

Args:
  - ata (string, obrigatório): título (ou parte do título) da ata.
  - data (string, opcional): data da reunião AAAA-MM-DD, pra desambiguar.
  - projeto (string, opcional): nome do cliente, pra desambiguar.
  - com_transcricao (boolean, opcional): inclui a transcrição (pode ser longa).`,
      inputSchema: {
        ata: z.string().min(1).max(200),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        projeto: z.string().max(200).optional(),
        com_transcricao: z.boolean().optional(),
      },
      annotations: LEITURA,
    },
    async ({ ata, data, projeto, com_transcricao }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();
        const resol = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resol.ok) return erro(resol.erro);
        const ctx = await contexto(admin, perfil.profileId);
        let q = admin.from("atas").select("*").ilike("title", `%${ata}%`).order("meeting_date", { ascending: false }).limit(20);
        if (resol.projeto) q = q.eq("project_id", resol.projeto.id);
        else q = soAtasVisiveis(q, ctx.verTudo, ctx.idsVisiveis);
        if (data) q = q.eq("meeting_date", data);
        const { data: lista } = await q;
        const visiveis = (lista ?? []).filter((a) => !a.project_id || ctx.verTudo || ctx.idsVisiveis.has(a.project_id));
        if (visiveis.length === 0) return erro(`Não achei nenhuma ata com "${ata}" no título.`);
        if (visiveis.length > 1) {
          return erro(`Mais de uma ata bate com "${ata}":\n${visiveis.map((a) => `- ${a.meeting_date} · ${a.title}`).join("\n")}\nChame de novo com a data.`);
        }
        const a = visiveis[0];
        const nomes = await nomesDasPessoas(admin);
        const partes = [
          `Ata: ${a.title}`,
          `Data: ${a.meeting_date}${a.start_time ? ` das ${String(a.start_time).slice(0, 5)}` : ""}${a.end_time ? ` às ${String(a.end_time).slice(0, 5)}` : ""}${a.place ? ` · ${a.place}` : ""}`,
          `Cliente: ${a.project_id ? ctx.nomeDoCliente.get(a.project_id) ?? "?" : "Reunião interna"}`,
          `Participantes da equipe: ${((a.participant_ids as string[]) ?? []).map((p) => nomes.get(p) ?? "?").join(", ") || "—"}`,
          a.external_participants ? `Participantes de fora: ${a.external_participants}` : null,
          `\nPauta:\n${htmlEmTexto(a.agenda_html) || "(vazia)"}`,
          `\nDecisões:\n${htmlEmTexto(a.decisions_html) || "(vazia)"}`,
          `\nPróximos passos:\n${htmlEmTexto(a.next_steps_html) || "(vazio)"}`,
          com_transcricao
            ? `\nTranscrição:\n${a.transcricao_texto ? corta(a.transcricao_texto, 60000) : "(sem transcrição)"}`
            : a.transcricao_texto
              ? "\n(Tem transcrição: chame de novo com com_transcricao=true pra ler.)"
              : null,
        ];
        return texto(partes.filter((p) => p !== null).join("\n"), { id: a.id, title: a.title });
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );
}
