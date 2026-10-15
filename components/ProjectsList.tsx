"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project } from "@/lib/types";
import { formatarRelativo } from "@/lib/format";
import { corDoCliente } from "@/lib/task-colors";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import { TipoDeServicoDialog } from "./TipoDeServico";
import type { PacoteDisponivel } from "@/lib/pacotes";
import {
  ChevronRightIcon,
  FolderIcon,
  GlobeIcon,
  LockIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  TargetIcon,
  Trash2Icon,
  UsersIcon,
} from "./ui/icons";

type Ordenacao = "recentes" | "antigos" | "az";

const CHAVE_DA_ORDENACAO = "dhub:clientes:ordenacao";

// Entre os responsáveis marcados, quem é o principal (o que o cliente vê no
// portal e que recebe as solicitações dele): quem já era, se continua na
// lista; senão, o primeiro marcado. Ninguém marcado = sem principal.
function responsavelPrincipal(atual: string | null | undefined, ids: string[]) {
  return atual && ids.includes(atual) ? atual : ids[0] ?? null;
}
const nomeDaPessoa = (p: Profile) => p.name || p.username || "Sem nome";

export default function ProjectsList({
  initialProjects,
  currentUserId = null,
  currentUserLabel = "",
  verTudo = false,
  profiles = [],
  pacotes = {},
  pacotesDisponiveis = null,
  title,
  subtitle,
}: {
  initialProjects: Project[];
  // Usados pra filtrar o que chega em tempo real, do mesmo jeito que a
  // busca inicial já vem filtrada do servidor.
  currentUserId?: string | null;
  // Nome/usuário de quem está logado, gravado no projeto na hora de criar —
  // é o que aparece no card pra identificar o dono (útil pra quem tem
  // "ve_tudo", hoje só a Emily).
  currentUserLabel?: string;
  // Quem tem "ve_tudo" (hoje só a Emily) não filtra nada — vê o projeto de
  // todo mundo assim que é criado.
  verTudo?: boolean;
  // A equipe: a fotinha de quem criou cada cliente e as pessoas que podem
  // ser marcadas como responsáveis.
  profiles?: Profile[];
  // O pacote que cada cliente tem neste mês (nome e ordem, sem valor); quem
  // não está aqui não tem pacote. Com algum cliente em pacote, a lista é
  // agrupada por pacote.
  pacotes?: Record<string, { nome: string; posicao: number }>;
  // Os pacotes que dá pra escolher pra um cliente; null = a troca não está
  // disponível (falta a migration 0056).
  pacotesDisponiveis?: PacoteDisponivel[] | null;
  title: string;
  subtitle: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [creating, setCreating] = useState(false);

  const [busca, setBusca] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState("");
  const [dataFiltro, setDataFiltro] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  // Cliente com a janela de responsáveis aberta.
  const [editandoResponsaveis, setEditandoResponsaveis] = useState<Project | null>(null);
  // Cliente com a janela de tipo de serviço aberta.
  const [editandoPacote, setEditandoPacote] = useState<Project | null>(null);

  // A ordenação escolhida fica guardada no navegador de cada pessoa.
  useEffect(() => {
    try {
      const salva = window.localStorage.getItem(CHAVE_DA_ORDENACAO);
      if (salva === "recentes" || salva === "antigos" || salva === "az") setOrdenacao(salva);
    } catch {
      // sem localStorage: fica na ordem padrão
    }
  }, []);
  function trocarOrdenacao(nova: Ordenacao) {
    setOrdenacao(nova);
    try {
      window.localStorage.setItem(CHAVE_DA_ORDENACAO, nova);
    } catch {
      // só não fica salvo pra próxima visita
    }
  }

  const avatarPorCriador = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.avatar_url])),
    [profiles]
  );
  const perfilPorId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  // Os responsáveis de um cliente (migration 0055), só os que ainda existem.
  const responsaveisDe = (project: Project) =>
    (project.responsible_ids ?? []).flatMap((id) => perfilPorId.get(id) ?? []);

  // No filtro entram os responsáveis de algum cliente e, pros clientes que
  // ainda não têm responsável marcado, quem criou — em vez de todo mundo
  // cadastrado no sistema.
  const pessoasDoFiltro = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) {
      const responsaveis = p.responsible_ids ?? [];
      if (responsaveis.length > 0) responsaveis.forEach((id) => ids.add(id));
      else if (p.created_by) ids.add(p.created_by);
    }
    return Array.from(ids)
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) => nomeDaPessoa(a).localeCompare(nomeDaPessoa(b), "pt-BR"));
  }, [projects, profiles]);

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = projects.filter((project) => {
      const responsaveis = project.responsible_ids ?? [];
      if (termo) {
        const nomeBate = project.name.toLowerCase().includes(termo);
        const pessoaBate =
          (project.created_by_label ?? "").toLowerCase().includes(termo) ||
          responsaveis.some((id) => {
            const pessoa = perfilPorId.get(id);
            return !!pessoa && nomeDaPessoa(pessoa).toLowerCase().includes(termo);
          });
        if (!nomeBate && !pessoaBate) return false;
      }
      // Com responsáveis marcados, vale a lista; sem nenhum, vale quem criou.
      if (
        responsavelFiltro &&
        !(responsaveis.length > 0 ? responsaveis.includes(responsavelFiltro) : project.created_by === responsavelFiltro)
      ) {
        return false;
      }
      if (dataFiltro && project.created_at.slice(0, 10) !== dataFiltro) {
        return false;
      }
      return true;
    });

    return [...filtrados].sort((a, b) =>
      ordenacao === "az"
        ? a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true })
        : ordenacao === "recentes"
          ? b.created_at.localeCompare(a.created_at)
          : a.created_at.localeCompare(b.created_at)
    );
  }, [projects, busca, responsavelFiltro, dataFiltro, ordenacao, perfilPorId]);

  // Com algum cliente em pacote, a lista vira um bloco por pacote (na ordem
  // dos pacotes) e, por último, os clientes sem pacote. Dentro de cada bloco
  // vale a ordenação escolhida.
  const grupos = useMemo(() => {
    if (!projetosFiltrados.some((p) => pacotes[p.id])) return null;
    const porPacote = new Map<string, { nome: string; posicao: number; clientes: Project[] }>();
    const semPacote: Project[] = [];
    for (const project of projetosFiltrados) {
      const pacote = pacotes[project.id];
      if (!pacote) {
        semPacote.push(project);
        continue;
      }
      const grupo = porPacote.get(pacote.nome) ?? { ...pacote, clientes: [] };
      grupo.clientes.push(project);
      porPacote.set(pacote.nome, grupo);
    }
    return [
      ...Array.from(porPacote.values())
        .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome, "pt-BR"))
        .map((g) => ({ titulo: `Pacote ${g.nome}`, clientes: g.clientes })),
      ...(semPacote.length > 0 ? [{ titulo: "Sem pacote", clientes: semPacote }] : []),
    ];
  }, [projetosFiltrados, pacotes]);

  const temFiltroAtivo =
    busca.trim() !== "" || responsavelFiltro !== "" || dataFiltro !== "";

  function limparFiltros() {
    setBusca("");
    setResponsavelFiltro("");
    setDataFiltro("");
  }

  useEffect(() => {
    const channel = supabase
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          setProjects((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Project;
              // Individual: só entra na hora se o projeto for meu ou for
              // público (a não ser que eu tenha "ve_tudo"). Se eu ganhar
              // uma tarefa num projeto privado de outra pessoa, ele só
              // aparece aqui no próximo carregamento da página.
              if (!verTudo && !novo.is_public && novo.created_by !== currentUserId) {
                return current;
              }
              if (current.some((p) => p.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Project;
              const jaEstava = current.some((p) => p.id === atualizado.id);
              if (!jaEstava) {
                // Não estava na lista — só entra agora se acabou de virar
                // público (ou eu tenho "ve_tudo"/sou o dono).
                if (
                  !verTudo &&
                  !atualizado.is_public &&
                  atualizado.created_by !== currentUserId
                ) {
                  return current;
                }
                return [atualizado, ...current];
              }
              return current.map((p) =>
                p.id === atualizado.id ? atualizado : p
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Project).id;
              return current.filter((p) => p.id !== removidoId);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, verTudo]);

  async function handleNewProject() {
    const nome = window.prompt("Nome do novo cliente:");
    if (!nome || !nome.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: nome.trim(), created_by_label: currentUserLabel })
      .select()
      .single();
    setCreating(false);

    if (!error && data) {
      setProjects((current) =>
        current.some((p) => p.id === data.id) ? current : [data, ...current]
      );
      router.push(`/projetos/${data.id}`);
    } else {
      window.alert(
        "Não deu pra criar o cliente. Confere se a migration 0012_projects.sql já foi rodada no Supabase."
      );
    }
  }

  async function handleRename(project: Project) {
    const novoNome = window.prompt("Novo nome do cliente:", project.name);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === project.name) {
      return;
    }

    const nomeLimpo = novoNome.trim();
    setProjects((current) =>
      current.map((p) => (p.id === project.id ? { ...p, name: nomeLimpo } : p))
    );
    await supabase
      .from("projects")
      .update({ name: nomeLimpo })
      .eq("id", project.id);
  }

  async function handleDelete(project: Project) {
    const confirmado = window.confirm(
      `Excluir o cliente "${project.name}"? As tarefas e páginas dele voltam para o quadro/wiki "Geral" — nada é apagado.`
    );
    if (!confirmado) return;

    setProjects((current) => current.filter((p) => p.id !== project.id));
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) {
      // 23503: o cliente tem serviços lançados no faturamento (migration 0044).
      setProjects((current) => (current.some((p) => p.id === project.id) ? current : [...current, project]));
      window.alert(
        error.code === "23503"
          ? `Não dá pra excluir "${project.name}": há serviços lançados no faturamento deste cliente.`
          : `Não foi possível excluir "${project.name}". Tenta de novo.`
      );
    }
  }

  // Grava os responsáveis do cliente (migration 0055) e, junto, o
  // responsável "principal" — o único que o cliente vê no portal e que
  // recebe as solicitações dele (projects.responsible_id). Antes o principal
  // era escolhido no cartão "Portal do cliente"; agora sai daqui. Devolve o
  // texto do erro, ou null se salvou.
  async function salvarResponsaveis(project: Project, ids: string[]): Promise<string | null> {
    const principalId = responsavelPrincipal(project.responsible_id, ids);
    const pessoa = principalId ? perfilPorId.get(principalId) : undefined;
    const principal = {
      responsible_id: principalId,
      responsible_label: pessoa ? nomeDaPessoa(pessoa) : null,
    };
    const { error } = await supabase
      .from("projects")
      .update({ responsible_ids: ids, ...principal })
      .eq("id", project.id);
    if (error) {
      // Sem a 0055 a lista não tem onde ficar, mas o principal tem: salva só
      // ele, pra o portal e as solicitações do cliente não ficarem sem dono.
      const soPrincipal = await supabase.from("projects").update(principal).eq("id", project.id);
      if (soPrincipal.error) return "Não deu pra salvar os responsáveis. Tenta de novo.";
      setProjects((current) => current.map((p) => (p.id === project.id ? { ...p, ...principal } : p)));
      return `Salvei só ${
        principal.responsible_label ?? "que o cliente ficou sem responsável"
      } como responsável no portal do cliente. Pra marcar mais de um, falta rodar a migration 0055_clientes_responsaveis_e_pacote.sql no Supabase.`;
    }
    setProjects((current) =>
      current.map((p) => (p.id === project.id ? { ...p, responsible_ids: ids, ...principal } : p))
    );
    return null;
  }

  // Projeto público: todo mundo vê, mesmo sem tarefa nele. Todo projeto
  // nasce privado — só vira público quem marcar aqui manualmente.
  async function handleTogglePublic(project: Project) {
    const novoValor = !project.is_public;
    setProjects((current) =>
      current.map((p) =>
        p.id === project.id ? { ...p, is_public: novoValor } : p
      )
    );
    await supabase
      .from("projects")
      .update({ is_public: novoValor })
      .eq("id", project.id);
  }

  // Nenhum projeto existe ainda: estado vazio central, sem barra de
  // ferramentas pela metade.
  if (projects.length === 0) {
    return (
      <div>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            className="py-16"
            icon={<FolderIcon className="h-8 w-8" />}
            title="Nenhum cliente ainda"
            description="Crie seu primeiro cliente para começar a organizar seu trabalho."
            action={
              <Button onClick={handleNewProject} disabled={creating}>
                <PlusIcon className="h-4 w-4" />
                {creating ? "Criando..." : "Criar cliente"}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={handleNewProject} disabled={creating}>
            <PlusIcon className="h-4 w-4" />
            {creating ? "Criando..." : "Novo cliente"}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchInput
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full sm:w-60"
        />
        <select
          value={responsavelFiltro}
          onChange={(e) => setResponsavelFiltro(e.target.value)}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Todos os responsáveis</option>
          {pessoasDoFiltro.map((p) => (
            <option key={p.id} value={p.id}>
              {nomeDaPessoa(p)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <select
          value={ordenacao}
          onChange={(e) => trocarOrdenacao(e.target.value as Ordenacao)}
          aria-label="Ordenar clientes"
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="az">Ordem alfabética (A–Z)</option>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
        </select>
        {temFiltroAtivo && (
          <button
            onClick={limparFiltros}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {projetosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            className="py-16"
            title="Não encontramos nenhum cliente."
            description="Experimente alterar sua busca ou filtro."
            action={
              <Button variant="secondary" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        </div>
      ) : (
        (grupos ?? [{ titulo: null, clientes: projetosFiltrados }]).map((grupo) => (
          <section key={grupo.titulo ?? "todos"} className="mb-7 last:mb-0">
            {grupo.titulo && (
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-ink">
                {grupo.titulo}
                <span className="text-xs font-normal text-ink-muted">
                  {grupo.clientes.length} {grupo.clientes.length === 1 ? "cliente" : "clientes"}
                </span>
              </h2>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grupo.clientes.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  avatarUrl={project.created_by ? avatarPorCriador.get(project.created_by) : null}
                  responsaveis={responsaveisDe(project)}
                  pacote={pacotes[project.id]?.nome ?? null}
                  onRename={() => handleRename(project)}
                  onDelete={() => handleDelete(project)}
                  onTogglePublic={() => handleTogglePublic(project)}
                  onResponsaveis={() => setEditandoResponsaveis(project)}
                  onPacote={pacotesDisponiveis ? () => setEditandoPacote(project) : undefined}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {editandoPacote && pacotesDisponiveis && (
        <TipoDeServicoDialog
          projectId={editandoPacote.id}
          clienteNome={editandoPacote.name}
          pacoteAtual={pacotes[editandoPacote.id]?.nome ?? null}
          pacotes={pacotesDisponiveis}
          aoFechar={() => setEditandoPacote(null)}
        />
      )}

      {editandoResponsaveis && (
        <ResponsaveisDoCliente
          project={editandoResponsaveis}
          profiles={profiles}
          aoSalvar={(ids) => salvarResponsaveis(editandoResponsaveis, ids)}
          aoFechar={() => setEditandoResponsaveis(null)}
        />
      )}
    </div>
  );
}

// Janela pra marcar quem da equipe é responsável pelo cliente. Pode ser mais
// de uma pessoa; a lista aparece no cartão do cliente.
function ResponsaveisDoCliente({
  project,
  profiles,
  aoSalvar,
  aoFechar,
}: {
  project: Project;
  profiles: Profile[];
  aoSalvar: (ids: string[]) => Promise<string | null>;
  aoFechar: () => void;
}) {
  // Cliente que só tem o responsável antigo do portal (sem a lista) abre com ele marcado.
  const [marcados, setMarcados] = useState<Set<string>>(
    new Set(
      (project.responsible_ids ?? []).length > 0
        ? project.responsible_ids
        : project.responsible_id
          ? [project.responsible_id]
          : []
    )
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pessoas = useMemo(
    () => [...profiles].sort((a, b) => nomeDaPessoa(a).localeCompare(nomeDaPessoa(b), "pt-BR")),
    [profiles]
  );
  // Na ordem da lista, e só quem ainda existe na equipe.
  const idsMarcados = pessoas.filter((p) => marcados.has(p.id)).map((p) => p.id);
  const principalId = responsavelPrincipal(project.responsible_id, idsMarcados);
  const principal = pessoas.find((p) => p.id === principalId) ?? null;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const falha = await aoSalvar(idsMarcados);
    setSalvando(false);
    if (falha) return setErro(falha);
    aoFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Responsáveis por ${project.name}`}
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl border border-line bg-surface p-5 shadow-dropdown"
      >
        <p className="text-sm font-semibold text-ink">Responsáveis por {project.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Marque quem da equipe cuida deste cliente. Eles aparecem no cartão do cliente.
        </p>
        <p className="mt-1.5 rounded-lg bg-canvas px-2.5 py-1.5 text-xs text-ink-muted">
          {principal
            ? `No portal, o cliente vê ${nomeDaPessoa(principal)} como responsável, e é pra essa pessoa que vão as solicitações dele.`
            : "Sem ninguém marcado, o portal fica sem responsável e as solicitações do cliente vão pra quem criou o cliente."}
        </p>
        <div className="scrollbar-thin mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {pessoas.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={marcados.has(p.id)}
                onChange={() =>
                  setMarcados((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(p.id)) novo.delete(p.id);
                    else novo.add(p.id);
                    return novo;
                  })
                }
                className="h-4 w-4 accent-[rgb(var(--color-brand))]"
              />
              <Avatar name={nomeDaPessoa(p)} src={p.avatar_url} size="sm" />
              <span className="min-w-0 truncate">{nomeDaPessoa(p)}</span>
            </label>
          ))}
        </div>
        {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const MAXIMO_DE_FOTOS = 4;

function ProjectCard({
  project,
  avatarUrl,
  responsaveis,
  pacote,
  onRename,
  onDelete,
  onTogglePublic,
  onResponsaveis,
  onPacote,
}: {
  project: Project;
  avatarUrl: string | null | undefined;
  // Quem cuida do cliente; vazio = ninguém marcado ainda (aparece quem criou).
  responsaveis: Profile[];
  // Nome do pacote do cliente neste mês, se tiver.
  pacote: string | null;
  onRename: () => void;
  onDelete: () => void;
  onTogglePublic: () => void;
  onResponsaveis: () => void;
  // Abre a janela de tipo de serviço; ausente = a troca não está disponível.
  onPacote?: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function handleClickFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [menuAberto]);

  // Cada cliente tem a sua cor (a mesma dos cartões de tarefa).
  const cor = corDoCliente(project);

  return (
    <div
      data-mov="bloco"
      className="group relative rounded-2xl border border-line bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      {/* Recorte arredondado só do conteúdo (o menu ⋮ fica de fora, pra não ser cortado). */}
      <div className="relative overflow-hidden rounded-[15px] pl-1.5">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1.5" style={{ backgroundColor: cor.fundo }} />
      <Link href={`/projetos/${project.id}`} className="block">
        <div
          className="px-4 py-3"
          style={{ backgroundColor: cor.fundo, color: cor.texto }}
        >
          <p className="pr-7 text-base font-semibold leading-snug">{project.name}</p>
        </div>
        <div className="p-4 pt-3">
        <p className="text-sm text-ink-muted">
          Quadro de tarefas e Wiki próprios
        </p>

        {(project.is_public || pacote) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {project.is_public && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-forte">
                <GlobeIcon className="h-3 w-3" />
                Público
              </span>
            )}
            {pacote && (
              <span className="inline-flex items-center rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-ink">
                Pacote {pacote}
              </span>
            )}
          </div>
        )}

        {responsaveis.length > 0 ? (
          <div className="mt-4 flex items-center gap-2">
            <span className="flex flex-shrink-0 -space-x-1.5">
              {responsaveis.slice(0, MAXIMO_DE_FOTOS).map((p) => (
                <Avatar
                  key={p.id}
                  name={nomeDaPessoa(p)}
                  src={p.avatar_url}
                  size="sm"
                  className="ring-2 ring-surface"
                />
              ))}
            </span>
            <span className="min-w-0 truncate text-xs text-ink-muted">
              {responsaveis
                .slice(0, 2)
                .map((p) => nomeDaPessoa(p).split(" ")[0])
                .join(", ")}
              {responsaveis.length > 2 && ` +${responsaveis.length - 2}`}
            </span>
          </div>
        ) : (
          project.created_by_label && (
            <div className="mt-4 flex items-center gap-2">
              <Avatar name={project.created_by_label} src={avatarUrl} size="sm" />
              <span className="text-xs text-ink-muted">{project.created_by_label}</span>
            </div>
          )
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-xs text-ink-muted">
            {formatarRelativo(project.created_at)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-forte">
            Abrir cliente
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        </div>
      </Link>
      </div>

      <div ref={menuRef} className="absolute right-2.5 top-2.5" style={{ color: cor.texto }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuAberto((v) => !v);
          }}
          title="Ações do cliente"
          aria-label="Ações do cliente"
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          data-open={menuAberto}
          className="rounded-md p-1 opacity-0 transition-opacity hover:bg-black/15 group-hover:opacity-100 data-[open=true]:opacity-100"
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </button>

        {menuAberto && (
          <div
            role="menu"
            className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-dropdown"
          >
            <Link
              href={`/projetos/${project.id}`}
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover"
              onClick={() => setMenuAberto(false)}
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
              Abrir
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onRename();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onResponsaveis();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              <UsersIcon className="h-3.5 w-3.5" />
              Responsáveis
            </button>
            {onPacote && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  onPacote();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
              >
                <TargetIcon className="h-3.5 w-3.5" />
                Tipo de serviço
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onTogglePublic();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
            >
              {project.is_public ? (
                <>
                  <LockIcon className="h-3.5 w-3.5" />
                  Tornar privado
                </>
              ) : (
                <>
                  <GlobeIcon className="h-3.5 w-3.5" />
                  Tornar público
                </>
              )}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-light"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
