import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeVerTudo } from "@/lib/permissions";
import { CATEGORIAS, ORDEM_DAS_CATEGORIAS, ORDEM_DAS_REDES, oQueFaltaProEnvio, redesValidas, REDES } from "@/lib/posts";
import {
  encontrarTarefasPorTitulo,
  hojeEmSP,
  mensagemDeErro,
  perfilDoContexto,
  projetosVisiveis,
  resolverProjeto,
  resolverResponsavel,
  STATUS_LABEL,
  tarefaEhVisivel,
  urlDoApp,
  type ContextoFerramenta,
} from "@/lib/mcp-server-helpers";
import type { PostCategory, PostNetwork, PostStatus, TaskStatus } from "@/lib/types";

// Ferramentas do MCP pros dois calendários do d.hub:
// * o calendário normal (/calendario) são as tarefas com período (início e
//   prazo): now_ver_calendario mostra a agenda; criar e remarcar é com
//   now_criar_tarefa / now_editar_tarefa (data_inicio, data_prazo);
// * o calendário de postagem (/postagens) são os posts por data prevista:
//   now_listar_posts (em mcp-leitura.ts) lista, e aqui ficam criar e editar
//   (remarcar, legenda, redes, formato, enviar ao cliente...), com as mesmas
//   regras da aba Posts (components/PostsManager.tsx). Arquivos do post (imagem,
//   vídeo, PDF) continuam sendo enviados pelo site.
// Mesma visibilidade da pessoa no site; a rota usa a service_role, então quem
// grava é marcado à mão (created_by).

type Admin = ReturnType<typeof createAdminClient>;

interface TarefaDoCalendario {
  id: string;
  title: string;
  status: string;
  project_id: string | null;
  start_date: string | null;
  due_date: string;
  created_by: string | null;
  assigned_to: string[] | null;
  parent_id: string | null;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DIAS = 62;
const PAGINA = 1000;
const MAX_PAGINAS = 10;
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const CATEGORIAS_ENUM = ORDEM_DAS_CATEGORIAS as [PostCategory, ...PostCategory[]];
const REDES_ENUM = ORDEM_DAS_REDES as [PostNetwork, ...PostNetwork[]];

const STATUS_DO_POST: Record<PostStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Aguardando o cliente",
  ajuste: "Cliente pediu ajuste",
  publicado: "Publicado",
};

function erro(texto: string) {
  return { isError: true, content: [{ type: "text" as const, text: texto }] };
}

// Só texto (sem structuredContent): ver o comentário em lib/mcp-leitura.ts.
function texto(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string) {
  return Math.round((new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86400000);
}

// Data válida de verdade (2026-02-30 não passa).
function dataValida(data: string) {
  return DATA.test(data) && new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;
}

// "2026-11-26" → "qua 26/11"
function rotuloDoDia(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

function ddmm(data: string) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

// Redes que fazem sentido pra cada formato quando a pessoa não diz quais.
function redesPadrao(categoria: PostCategory): PostNetwork[] {
  if (categoria === "documento") return ["linkedin"];
  if (categoria === "youtube" || categoria === "shorts") return ["youtube"];
  return ["instagram"];
}

function linkDoPost(projectId: string, postId: string) {
  return urlDoApp(`/projetos/${projectId}?aba=posts&post=${postId}`);
}

// O post pelo código, se a pessoa enxerga o cliente dele.
async function postVisivel(admin: Admin, profileId: string, id: string) {
  const { data: post } = await admin
    .from("posts")
    .select("id, project_id, category, caption, networks, scheduled_date, status, media, cover, task_id")
    .eq("id", id)
    .maybeSingle();
  if (!post) return null;
  const verTudo = await podeVerTudo(admin, profileId);
  if (!verTudo) {
    const visiveis = await projetosVisiveis(admin, profileId);
    if (!visiveis.some((p) => p.id === post.project_id)) return null;
  }
  return post;
}

export function registrarFerramentasDoCalendario(server: McpServer) {
  server.registerTool(
    "now_ver_calendario",
    {
      title: "Ver calendário",
      description: `Mostra o calendário do d.hub (o mesmo da tela Calendário): as tarefas com data num período, dia a dia, com status, cliente, responsáveis e o período de cada uma (início → prazo). Use pra "minha agenda da semana", "o que a Ana tem em dezembro", "o que vence amanhã".

Para pôr algo no calendário, crie uma tarefa com data (now_criar_tarefa). Para remarcar, mude data_inicio/data_prazo com now_editar_tarefa. Os posts do calendário de postagem ficam em now_listar_posts.

Args:
  - de (string, opcional): primeiro dia, AAAA-MM-DD. Padrão: hoje.
  - ate (string, opcional): último dia, AAAA-MM-DD. Padrão: 6 dias depois de "de" (uma semana). No máximo ${MAX_DIAS} dias de período.
  - quem (string, opcional): "eu" (padrão: as tarefas que a pessoa criou ou em que é responsável, como em "Meu calendário"), o nome de alguém do time (as tarefas em que essa pessoa é responsável) ou "todos" (tudo o que a pessoa enxerga).
  - projeto (string, opcional): nome do cliente, pra ver só as tarefas dele.
  - so_em_aberto (boolean, opcional): true = esconde as concluídas. Canceladas nunca aparecem.

Retorna: as tarefas que caem no período (começam, terminam ou atravessam), agrupadas pelo dia do prazo.`,
      inputSchema: {
        de: z.string().regex(DATA, "Use AAAA-MM-DD").optional(),
        ate: z.string().regex(DATA, "Use AAAA-MM-DD").optional(),
        quem: z.string().max(200).optional(),
        projeto: z.string().max(200).optional(),
        so_em_aberto: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ de, ate, quem, projeto, so_em_aberto }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();

        const inicio = de ?? hojeEmSP();
        const fim = ate ?? somarDias(inicio, 6);
        if (!dataValida(inicio) || !dataValida(fim)) return erro("Data inválida. Use AAAA-MM-DD (ex.: 2026-12-01).");
        if (fim < inicio) return erro(`"ate" (${fim}) vem antes de "de" (${inicio}).`);
        if (diasEntre(inicio, fim) > MAX_DIAS) {
          return erro(`Período grande demais: no máximo ${MAX_DIAS} dias por vez. Divida em partes.`);
        }

        const resolProjeto = await resolverProjeto(admin, perfil.profileId, projeto);
        if (!resolProjeto.ok) return erro(resolProjeto.erro);

        const alvo = (quem ?? "eu").trim().toLowerCase();
        const todos = ["todos", "todo mundo", "equipe", "time", "geral"].includes(alvo);
        let pessoaId: string | null = null;
        if (!todos) {
          const resol = await resolverResponsavel(admin, perfil.profileId, quem?.trim() ? quem : "eu");
          if (!resol.ok) return erro(resol.erro);
          pessoaId = resol.ids[0] ?? perfil.profileId;
        }
        const ehEu = pessoaId === perfil.profileId;

        const [verTudo, visiveis, { data: pessoas }] = await Promise.all([
          podeVerTudo(admin, perfil.profileId),
          projetosVisiveis(admin, perfil.profileId),
          admin.from("profiles").select("id, name, username"),
        ]);
        const idsVisiveis = new Set(visiveis.map((p) => p.id));
        const nomeDoCliente = new Map(visiveis.map((p) => [p.id, p.name]));
        const nomeDaPessoa = new Map((pessoas ?? []).map((p) => [p.id as string, (p.name || p.username || "?") as string]));

        // Cai no período: o prazo é depois do início do período e o começo da
        // tarefa (ou o prazo, se ela não tem início) é antes do fim.
        // Lido em páginas: a API devolve no máximo 1000 linhas por vez, e a
        // visibilidade só é filtrada depois (aqui embaixo).
        const consulta = (de: number) => {
          let q = admin
            .from("tasks")
            .select("id, title, status, project_id, start_date, due_date, created_by, assigned_to, parent_id")
            .not("due_date", "is", null)
            .neq("status", "cancelled")
            .gte("due_date", inicio)
            .or(`start_date.lte.${fim},and(start_date.is.null,due_date.lte.${fim})`)
            .order("due_date", { ascending: true })
            .order("id", { ascending: true })
            .range(de, de + PAGINA - 1);
          if (resolProjeto.projeto) q = q.eq("project_id", resolProjeto.projeto.id);
          if (so_em_aberto) q = q.neq("status", "done");
          return q;
        };
        const lidas: TarefaDoCalendario[] = [];
        let cortado = true;
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
          const { data, error } = await consulta(pagina * PAGINA);
          if (error) return erro("Não deu pra ler o calendário agora. Tente de novo.");
          lidas.push(...((data ?? []) as TarefaDoCalendario[]));
          if (!data || data.length < PAGINA) {
            cortado = false;
            break;
          }
        }

        const tarefas = lidas.filter((t) => {
          const assigned = (t.assigned_to ?? []) as string[];
          if (!tarefaEhVisivel({ project_id: t.project_id, created_by: t.created_by, assigned_to: assigned }, perfil.profileId, verTudo, idsVisiveis)) {
            return false;
          }
          if (todos) return true;
          // "Meu calendário": o que criei ou em que sou responsável. De outra
          // pessoa: em que ela é responsável.
          return ehEu ? t.created_by === perfil.profileId || assigned.includes(perfil.profileId) : assigned.includes(pessoaId!);
        });

        const deQuem = todos ? "de todo mundo que você vê" : ehEu ? "seu" : `de ${nomeDaPessoa.get(pessoaId!) ?? quem}`;
        const cabecalho = `Calendário ${deQuem}${resolProjeto.projeto ? ` em ${resolProjeto.projeto.name}` : ""}, ${ddmm(inicio)} a ${ddmm(fim)}`;
        if (tarefas.length === 0 && !cortado) return texto(`${cabecalho}: nada marcado.`);

        const ordenadas = [...tarefas].sort(
          (a, b) => (a.due_date as string).localeCompare(b.due_date as string) || (a.title as string).localeCompare(b.title as string, "pt-BR")
        );
        const linhas: string[] = [`${cabecalho} (${ordenadas.length} tarefa${ordenadas.length === 1 ? "" : "s"}):`];
        let diaAtual = "";
        for (const t of ordenadas) {
          const prazo = t.due_date as string;
          if (prazo !== diaAtual) {
            diaAtual = prazo;
            linhas.push("", prazo > fim ? `Entrega em ${rotuloDoDia(prazo)} (já em andamento no período)` : rotuloDoDia(prazo));
          }
          const cliente = t.project_id ? nomeDoCliente.get(t.project_id) ?? "?" : "Geral";
          const resp = ((t.assigned_to ?? []) as string[]).map((id) => nomeDaPessoa.get(id) ?? "?").join(", ");
          const periodo = t.start_date && t.start_date !== prazo ? ` · de ${ddmm(t.start_date as string)} a ${ddmm(prazo)}` : "";
          linhas.push(
            `- [${STATUS_LABEL[t.status as TaskStatus] ?? t.status}] ${t.title}${t.parent_id ? " (subtarefa)" : ""} (${cliente})${resp ? ` · ${resp}` : " · sem responsável"}${periodo}`
          );
        }
        if (cortado) linhas.push("", "(Período com tarefas demais: a lista pode estar incompleta. Peça um período menor.)");
        linhas.push("", `No site: ${urlDoApp("/calendario")}`);
        return texto(linhas.join("\n"));
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_criar_post",
    {
      title: "Criar post no calendário de postagem",
      description: `Cria um post (rascunho) no calendário de postagem de um cliente, com formato, data prevista, redes e legenda. Os arquivos (imagem, vídeo ou PDF) a pessoa envia depois pelo site, no link que a ferramenta devolve. O cliente só vê o post quando ele for enviado (now_editar_post com acao "enviar_ao_cliente").

Args:
  - cliente (string, obrigatório): nome do cliente (ou parte dele).
  - formato (string, opcional): ${ORDEM_DAS_CATEGORIAS.map((c) => `"${c}" (${CATEGORIAS[c].rotulo})`).join(", ")}. Padrão: "estatico".
  - data (string, opcional): data prevista da postagem, AAAA-MM-DD.
  - legenda (string, opcional): o texto do post (Story não leva legenda).
  - redes (lista, opcional): ${ORDEM_DAS_REDES.map((r) => `"${r}"`).join(", ")}. Padrão pelo formato: PDF → linkedin; YouTube e Shorts → youtube; o resto → instagram.
  - tarefa (string, opcional): título (ou parte) de uma tarefa desse cliente, pra ligar o post a ela (o post passa a aparecer com o nome da tarefa).

Retorna: confirmação, o código do post (pra editar depois) e o link pra subir os arquivos.`,
      inputSchema: {
        cliente: z.string().min(1).max(200),
        formato: z.enum(CATEGORIAS_ENUM).optional(),
        data: z.string().regex(DATA, "Use AAAA-MM-DD").optional(),
        legenda: z.string().max(5000).optional(),
        redes: z.array(z.enum(REDES_ENUM)).min(1).max(5).optional(),
        tarefa: z.string().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ cliente, formato, data, legenda, redes, tarefa }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();

        const resol = await resolverProjeto(admin, perfil.profileId, cliente);
        if (!resol.ok) return erro(resol.erro);
        if (!resol.projeto) return erro("Diga de qual cliente é o post.");
        if (data && !dataValida(data)) return erro("Data inválida. Use AAAA-MM-DD (ex.: 2026-12-01).");

        let taskId: string | null = null;
        let tituloDaTarefa: string | null = null;
        if (tarefa) {
          const candidatas = await encontrarTarefasPorTitulo(admin, perfil.profileId, tarefa, resol.projeto.id);
          if (candidatas.length === 0) return erro(`Não achei tarefa com "${tarefa}" no título em ${resol.projeto.name}.`);
          if (candidatas.length > 1) {
            return erro(
              `Mais de uma tarefa de ${resol.projeto.name} bate com "${tarefa}":\n${candidatas.map((t) => `- ${t.title}`).join("\n")}\nChame de novo com um título mais específico.`
            );
          }
          taskId = candidatas[0].id;
          tituloDaTarefa = candidatas[0].title;
        }

        const categoria: PostCategory = formato ?? "estatico";
        const redesFinais = redes ? redesValidas(redes) : redesPadrao(categoria);
        const { data: post, error } = await admin
          .from("posts")
          .insert({
            project_id: resol.projeto.id,
            category: categoria,
            caption: (legenda ?? "").trim(),
            networks: redesFinais,
            scheduled_date: data ?? null,
            status: "rascunho",
            task_id: taskId,
            created_by: perfil.profileId,
            created_by_label: perfil.username ?? perfil.nome,
          })
          .select("id")
          .single();
        if (error || !post) return erro("Não foi possível criar o post. Tente de novo.");

        const falta = oQueFaltaProEnvio({ category: categoria, caption: (legenda ?? "").trim(), networks: redesFinais, quantasMidias: 0 });
        const linhas = [
          `Post criado como rascunho em ${resol.projeto.name}: ${CATEGORIAS[categoria].rotulo}${data ? ` para ${rotuloDoDia(data)}` : " sem data"} (${redesFinais.map((r) => REDES[r]).join(", ")}).`,
          tituloDaTarefa ? `Ligado à tarefa "${tituloDaTarefa}".` : null,
          `Código do post: ${post.id}`,
          falta ? `Antes de enviar ao cliente: ${falta.charAt(0).toLowerCase()}${falta.slice(1)} ${CATEGORIAS[categoria].dica}` : null,
          `Subir os arquivos no site: ${linkDoPost(resol.projeto.id, post.id)}`,
        ];
        return texto(linhas.filter(Boolean).join("\n"));
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );

  server.registerTool(
    "now_editar_post",
    {
      title: "Editar post do calendário de postagem",
      description: `Edita um post do calendário de postagem: remarca a data, troca legenda, redes ou formato, e envia ao cliente, cancela o envio ou marca como publicado. Só muda o que for informado. Pegue o código do post em now_listar_posts.

Regras (as mesmas da aba Posts do site):
  - Post publicado só muda de data.
  - O formato só muda enquanto o post não tem arquivos (com arquivos, troque pelo site).
  - "enviar_ao_cliente": de rascunho ou de ajuste pedido; o post precisa estar completo (arquivos, rede e legenda). O cliente é avisado no portal.
  - "cancelar_envio": de "aguardando o cliente" volta a rascunho e some pro cliente (os comentários ficam).
  - "marcar_publicado": de "aguardando o cliente" ou de ajuste pedido.

Args:
  - post (string, obrigatório): código do post (aparece em now_listar_posts).
  - nova_data (string, opcional): nova data prevista, AAAA-MM-DD. "remover" tira a data.
  - legenda (string, opcional): nova legenda ("" apaga).
  - redes (lista, opcional): ${ORDEM_DAS_REDES.map((r) => `"${r}"`).join(", ")} (substitui as atuais).
  - formato (string, opcional): ${ORDEM_DAS_CATEGORIAS.map((c) => `"${c}"`).join(", ")}.
  - acao (string, opcional): "enviar_ao_cliente", "cancelar_envio" ou "marcar_publicado".

Retorna: o que mudou e o link do post.`,
      inputSchema: {
        post: z.string().regex(ID, "Use o código do post que aparece em now_listar_posts."),
        nova_data: z.string().max(20).optional(),
        legenda: z.string().max(5000).optional(),
        redes: z.array(z.enum(REDES_ENUM)).min(1).max(5).optional(),
        formato: z.enum(CATEGORIAS_ENUM).optional(),
        acao: z.enum(["enviar_ao_cliente", "cancelar_envio", "marcar_publicado"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ post: postId, nova_data, legenda, redes, formato, acao }, extra) => {
      try {
        const perfil = perfilDoContexto(extra as ContextoFerramenta);
        const admin = createAdminClient();

        if (nova_data === undefined && legenda === undefined && !redes && !formato && !acao) {
          return erro("Diga o que mudar: nova_data, legenda, redes, formato ou acao.");
        }
        const post = await postVisivel(admin, perfil.profileId, postId);
        if (!post) return erro("Não achei esse post (ou ele é de um cliente que você não vê). Confira o código em now_listar_posts.");

        const status = post.status as PostStatus;
        const mudaConteudo = legenda !== undefined || !!redes || !!formato;
        if (mudaConteudo && status === "publicado") {
          return erro("Post publicado não se edita (no site também não). Só a data pode mudar.");
        }

        const campos: Record<string, unknown> = {};
        const feito: string[] = [];

        if (nova_data !== undefined) {
          const limpa = nova_data.trim().toLowerCase();
          if (limpa === "remover" || limpa === "") {
            campos.scheduled_date = null;
            feito.push("data removida");
          } else if (dataValida(limpa)) {
            campos.scheduled_date = limpa;
            feito.push(`data: ${post.scheduled_date ? rotuloDoDia(post.scheduled_date) : "sem data"} → ${rotuloDoDia(limpa)}`);
          } else {
            return erro('nova_data inválida. Use AAAA-MM-DD, ou "remover".');
          }
        }

        const midias = Array.isArray(post.media) ? post.media.length : 0;
        let categoria = post.category as PostCategory;
        if (formato && formato !== categoria) {
          if (midias > 0 || post.cover) {
            return erro("Esse post já tem arquivos: troque o formato pelo site, onde dá pra ajustar os arquivos junto.");
          }
          campos.category = formato;
          feito.push(`formato: ${CATEGORIAS[categoria].rotulo} → ${CATEGORIAS[formato].rotulo}`);
          categoria = formato;
        }
        let legendaFinal = (post.caption ?? "") as string;
        if (legenda !== undefined) {
          legendaFinal = legenda.trim();
          campos.caption = legendaFinal;
          feito.push(legendaFinal ? "legenda trocada" : "legenda apagada");
        }
        let redesFinais = redesValidas(post.networks as string[]);
        if (redes) {
          redesFinais = redesValidas(redes);
          campos.networks = redesFinais;
          feito.push(`redes: ${redesFinais.map((r) => REDES[r]).join(", ")}`);
        }

        if (acao === "enviar_ao_cliente") {
          if (status !== "rascunho" && status !== "ajuste") {
            return erro(`Só dá pra enviar post em rascunho ou com ajuste pedido (este está "${STATUS_DO_POST[status]}").`);
          }
          const falta = oQueFaltaProEnvio({ category: categoria, caption: legendaFinal, networks: redesFinais, quantasMidias: midias });
          if (falta) {
            return erro(
              `Ainda não dá pra enviar: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}${midias === 0 ? ` Os arquivos sobem pelo site: ${linkDoPost(post.project_id, post.id)}` : ""}`
            );
          }
          campos.status = "enviado";
          feito.push(status === "ajuste" ? "reenviado ao cliente com os ajustes" : "enviado ao cliente (ele é avisado no portal)");
        } else if (acao === "cancelar_envio") {
          if (status !== "enviado") return erro(`Só dá pra cancelar o envio de post aguardando o cliente (este está "${STATUS_DO_POST[status]}").`);
          campos.status = "rascunho";
          feito.push("envio cancelado: voltou a rascunho e o cliente deixa de ver");
        } else if (acao === "marcar_publicado") {
          if (status !== "enviado" && status !== "ajuste") {
            return erro(`Só dá pra marcar como publicado post aguardando o cliente ou com ajuste pedido (este está "${STATUS_DO_POST[status]}").`);
          }
          campos.status = "publicado";
          feito.push("marcado como publicado");
        }

        // Tudo que o cliente vê (ou vai ver) precisa estar completo, como no
        // formulário do site. Só remarcar ou só marcar publicado não confere.
        const statusFinal = (campos.status as PostStatus | undefined) ?? status;
        if (mudaConteudo && statusFinal !== "rascunho" && acao !== "enviar_ao_cliente") {
          const falta = oQueFaltaProEnvio({ category: categoria, caption: legendaFinal, networks: redesFinais, quantasMidias: midias });
          if (falta) return erro(`O cliente já vê esse post, e assim ele ficaria incompleto: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}`);
        }

        if (Object.keys(campos).length === 0) return texto("Nada mudou: o post já estava assim.");

        // Só grava se o status ainda é o que foi lido: se o cliente pediu ajuste
        // (ou alguém publicou) no meio, não passa por cima.
        const { data: gravado, error } = await admin
          .from("posts")
          .update(campos)
          .eq("id", post.id)
          .eq("status", status)
          .select("id");
        if (error) return erro("Não foi possível salvar o post. Tente de novo.");
        if (!gravado || gravado.length === 0) {
          return erro("O post mudou enquanto eu editava (o cliente ou alguém da equipe mexeu nele). Confira com now_listar_posts e tente de novo.");
        }

        return texto(`Post atualizado (${CATEGORIAS[categoria].rotulo}): ${feito.join("; ")}.\n${linkDoPost(post.project_id, post.id)}`);
      } catch (e) {
        return erro(mensagemDeErro(e));
      }
    }
  );
}
