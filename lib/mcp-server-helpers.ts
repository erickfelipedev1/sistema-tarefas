import type { SupabaseClient } from "@supabase/supabase-js";
import { podeVerTudo } from "./permissions";
import type { TaskStatus } from "./types";

// Funções compartilhadas pelas ferramentas do MCP (app/api/mcp/route.ts) —
// resolver "nome do projeto"/"nome da pessoa" em texto livre (do jeito que
// uma IA vai escrever, não um id) pros registros reais no banco, sempre
// respeitando a mesma visibilidade que a pessoa já tem dentro do próprio
// site (board individual x projeto compartilhado). Extraído pra cá pra não
// duplicar essa lógica entre as 5 ferramentas.

export interface ProjetoResumo {
  id: string;
  name: string;
}

export interface TarefaEncontrada {
  id: string;
  title: string;
  status: string;
  project_id: string | null;
  due_date: string | null;
}

// Mesmo filtro do menu lateral (components/Sidebar.tsx) e da tela de
// Projetos: projetos que eu criei, projetos públicos, ou projetos onde eu
// tenho pelo menos uma tarefa — exceto quem tem "ve_tudo", que enxerga
// todos.
export async function projetosVisiveis(
  admin: SupabaseClient,
  profileId: string
): Promise<ProjetoResumo[]> {
  const verTudo = await podeVerTudo(admin, profileId);

  if (verTudo) {
    const { data } = await admin
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });
    return data ?? [];
  }

  const { data: minhasTarefas } = await admin
    .from("tasks")
    .select("project_id")
    .or(`created_by.eq.${profileId},assigned_to.cs.{${profileId}}`)
    .not("project_id", "is", null);

  const idsDeProjetos = Array.from(
    new Set(
      (minhasTarefas ?? [])
        .map((t) => t.project_id as string | null)
        .filter((id): id is string => !!id)
    )
  );

  const filtro = idsDeProjetos.length
    ? `created_by.eq.${profileId},is_public.eq.true,id.in.(${idsDeProjetos.join(",")})`
    : `created_by.eq.${profileId},is_public.eq.true`;

  const { data } = await admin
    .from("projects")
    .select("id, name")
    .or(filtro)
    .order("name", { ascending: true });

  return data ?? [];
}

// "cria uma tarefa no projeto Website da NDL" → acha o projeto certo entre
// os que essa pessoa enxerga, por nome (parcial, sem diferenciar
// maiúsculas). Sem "projeto" nenhum informado = tarefa vai pra "Geral"
// (project_id null), do jeito que já funciona no resto do sistema.
export async function resolverProjeto(
  admin: SupabaseClient,
  profileId: string,
  nomeProjeto: string | undefined
): Promise<
  | { ok: true; projeto: ProjetoResumo | null }
  | { ok: false; erro: string }
> {
  if (!nomeProjeto || !nomeProjeto.trim()) {
    return { ok: true, projeto: null };
  }

  const visiveis = await projetosVisiveis(admin, profileId);
  const busca = nomeProjeto.trim().toLowerCase();
  const candidatos = visiveis.filter((p) => p.name.toLowerCase().includes(busca));

  if (candidatos.length === 0) {
    const lista = visiveis.map((p) => `"${p.name}"`).join(", ") || "nenhum";
    return {
      ok: false,
      erro: `Não achei nenhum projeto chamado "${nomeProjeto}" (entre os que essa pessoa enxerga). Projetos disponíveis: ${lista}. Confira o nome ou chame now_listar_projetos.`,
    };
  }

  if (candidatos.length > 1) {
    const lista = candidatos.map((p) => `"${p.name}"`).join(", ");
    return {
      ok: false,
      erro: `Mais de um projeto bate com "${nomeProjeto}": ${lista}. Chame de novo com o nome completo/mais específico.`,
    };
  }

  return { ok: true, projeto: candidatos[0] };
}

// "atribui pro João" / "cria uma tarefa pra mim" → acha a pessoa certa.
// Aceita "eu"/"mim"/"minha"/"eu mesmo" como sinônimo de quem está pedindo.
export async function resolverResponsavel(
  admin: SupabaseClient,
  profileId: string,
  nomeResponsavel: string | undefined
): Promise<{ ok: true; ids: string[] } | { ok: false; erro: string }> {
  if (!nomeResponsavel || !nomeResponsavel.trim()) {
    return { ok: true, ids: [] };
  }

  const normalizado = nomeResponsavel.trim().toLowerCase();
  if (["eu", "mim", "minha", "eu mesmo", "eu mesma", "me"].includes(normalizado)) {
    return { ok: true, ids: [profileId] };
  }

  const { data } = await admin
    .from("profiles")
    .select("id, name, username")
    .order("name", { ascending: true });

  const candidatos = (data ?? []).filter((p) => {
    const nome = (p.name ?? "").toLowerCase();
    const username = (p.username ?? "").toLowerCase();
    return nome.includes(normalizado) || username.includes(normalizado);
  });

  if (candidatos.length === 0) {
    return {
      ok: false,
      erro: `Não achei ninguém chamado "${nomeResponsavel}" no time.`,
    };
  }
  if (candidatos.length > 1) {
    const lista = candidatos
      .map((p) => `"${p.name || p.username}"`)
      .join(", ");
    return {
      ok: false,
      erro: `Mais de uma pessoa bate com "${nomeResponsavel}": ${lista}. Seja mais específico.`,
    };
  }

  return { ok: true, ids: [candidatos[0].id] };
}

// Mesma regra do quadro principal (components/TaskBoard.tsx,
// getNextPosition): posição = maior posição já usada nesse status, + 1.
// Só considera o status, não o projeto — é assim que o quadro já funciona.
export async function proximaPosicao(
  admin: SupabaseClient,
  status: TaskStatus
): Promise<number> {
  const { data } = await admin
    .from("tasks")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: false })
    .limit(1);

  const maior = data?.[0]?.position ?? 0;
  return maior + 1;
}

// Mesma regra de visibilidade de tarefa "Geral" (sem projeto) usada no
// board individual: só as que essa pessoa criou ou pra quem foram
// atribuídas — a não ser que ela tenha "ve_tudo". Tarefa DENTRO de um
// projeto que a pessoa já enxerga é sempre visível pra ela (mesma regra da
// tela de projetos, onde todo mundo vê as tarefas de um projeto
// compartilhado).
export function tarefaEhVisivel(
  tarefa: { project_id: string | null; created_by: string | null; assigned_to: string[] },
  profileId: string,
  verTudo: boolean,
  idsDeProjetosVisiveis: Set<string>
): boolean {
  if (tarefa.project_id) {
    return verTudo || idsDeProjetosVisiveis.has(tarefa.project_id);
  }
  return (
    verTudo ||
    tarefa.created_by === profileId ||
    tarefa.assigned_to.includes(profileId)
  );
}

// "marca a tarefa X como concluída" → acha a tarefa certa por título
// (parcial), só entre as que essa pessoa enxerga — opcionalmente já
// restrita a um projeto specific (resolvido antes com resolverProjeto).
export async function encontrarTarefasPorTitulo(
  admin: SupabaseClient,
  profileId: string,
  titulo: string,
  projetoId: string | null | undefined
): Promise<TarefaEncontrada[]> {
  const verTudo = await podeVerTudo(admin, profileId);
  const visiveis = await projetosVisiveis(admin, profileId);
  const idsVisiveis = new Set(visiveis.map((p) => p.id));

  let query = admin
    .from("tasks")
    .select("id, title, status, project_id, due_date, created_by, assigned_to")
    .ilike("title", `%${titulo}%`)
    .limit(50);

  if (projetoId) {
    query = query.eq("project_id", projetoId);
  }

  const { data } = await query;

  return (data ?? [])
    .filter((t) =>
      tarefaEhVisivel(
        {
          project_id: t.project_id,
          created_by: t.created_by,
          assigned_to: t.assigned_to ?? [],
        },
        profileId,
        verTudo,
        idsVisiveis
      )
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      project_id: t.project_id,
      due_date: t.due_date,
    }));
}

// Monta o link completo da tarefa/projeto quando NEXT_PUBLIC_SITE_URL está
// configurada (opcional) — senão devolve só o caminho relativo, que ainda
// serve de referência mesmo sem virar link clicável.
export function urlDoApp(caminho: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return caminho;
  return `${base.replace(/\/$/, "")}${caminho}`;
}

export const STATUS_VALIDOS: TaskStatus[] = ["todo", "doing", "dependency", "approval", "done", "cancelled"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  dependency: "Em dependência",
  approval: "Em aprovação",
  done: "Concluída",
  cancelled: "Cancelada",
};

// Quem está chamando a ferramenta (o token já foi conferido na rota do MCP).
export interface ContextoFerramenta {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

export function perfilDoContexto(extra: ContextoFerramenta): {
  profileId: string;
  nome: string;
  username: string | null;
} {
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

export function mensagemDeErro(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return `Erro: ${msg}`;
}

// Hoje no horário de Brasília (AAAA-MM-DD), como o resto do sistema.
export function hojeEmSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// "coloca no projeto Site novo" → acha o projeto (migration 0083) entre os do
// cliente da tarefa, por nome (parcial, sem diferenciar maiúsculas).
export async function resolverSubprojeto(
  admin: SupabaseClient,
  clienteId: string,
  nome: string
): Promise<{ ok: true; id: string; name: string } | { ok: false; erro: string }> {
  const { data, error } = await admin.from("subprojects").select("id, name").eq("project_id", clienteId);
  if (error) return { ok: false, erro: "Os projetos do cliente ainda não estão disponíveis (migration 0083)." };
  const lista = (data ?? []) as { id: string; name: string }[];
  const busca = nome.trim().toLowerCase();
  const exato = lista.filter((p) => p.name.toLowerCase() === busca);
  const candidatos = exato.length ? exato : lista.filter((p) => p.name.toLowerCase().includes(busca));
  if (candidatos.length === 1) return { ok: true, ...candidatos[0] };
  const nomes = lista.map((p) => `"${p.name}"`).join(", ") || "nenhum";
  return {
    ok: false,
    erro:
      candidatos.length === 0
        ? `Não achei o projeto "${nome}" nesse cliente. Projetos do cliente: ${nomes}. Use now_listar_projetos_do_cliente.`
        : `Mais de um projeto do cliente bate com "${nome}": ${candidatos.map((p) => `"${p.name}"`).join(", ")}.`,
  };
}

// Texto simples a partir do HTML limpo do editor (descrição formatada, atas),
// sem DOM: quebra de linha nos blocos, "- " nos itens de lista.
export function htmlEmTexto(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
