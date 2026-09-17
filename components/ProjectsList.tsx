"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project } from "@/lib/types";
import { formatarRelativo } from "@/lib/format";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import {
  ChevronRightIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "./ui/icons";

type Ordenacao = "recentes" | "antigos";

export default function ProjectsList({
  initialProjects,
  currentUserId = null,
  currentUserLabel = "",
  verTudo = false,
  profiles = [],
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
  // Usado só pra buscar a fotinha de quem criou cada projeto.
  profiles?: Profile[];
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

  const avatarPorCriador = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.avatar_url])),
    [profiles]
  );

  // Só lista, no filtro, quem já criou pelo menos um projeto — em vez de
  // todo mundo cadastrado no sistema.
  const criadores = useMemo(() => {
    const ids = new Set(
      projects.map((p) => p.created_by).filter((id): id is string => !!id)
    );
    return Array.from(ids)
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) =>
        (a.name || a.username || "").localeCompare(b.name || b.username || "")
      );
  }, [projects, profiles]);

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = projects.filter((project) => {
      if (termo) {
        const nomeBate = project.name.toLowerCase().includes(termo);
        const pessoaBate = (project.created_by_label ?? "")
          .toLowerCase()
          .includes(termo);
        if (!nomeBate && !pessoaBate) return false;
      }
      if (responsavelFiltro && project.created_by !== responsavelFiltro) {
        return false;
      }
      if (dataFiltro && project.created_at.slice(0, 10) !== dataFiltro) {
        return false;
      }
      return true;
    });

    return [...filtrados].sort((a, b) =>
      ordenacao === "recentes"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
    );
  }, [projects, busca, responsavelFiltro, dataFiltro, ordenacao]);

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
              // Individual: só entra na hora se o projeto for meu (a não
              // ser que eu tenha "ve_tudo"). Se eu ganhar uma tarefa num
              // projeto de outra pessoa, ele só aparece aqui no próximo
              // carregamento da página.
              if (!verTudo && novo.created_by !== currentUserId) {
                return current;
              }
              if (current.some((p) => p.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Project;
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
    const nome = window.prompt("Nome do novo projeto:");
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
        "Não deu pra criar o projeto. Confere se a migration 0012_projects.sql já foi rodada no Supabase."
      );
    }
  }

  async function handleRename(project: Project) {
    const novoNome = window.prompt("Novo nome do projeto:", project.name);
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
      `Excluir o projeto "${project.name}"? As tarefas e páginas dele voltam para o quadro/wiki "Geral" — nada é apagado.`
    );
    if (!confirmado) return;

    setProjects((current) => current.filter((p) => p.id !== project.id));
    await supabase.from("projects").delete().eq("id", project.id);
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
            title="Nenhum projeto ainda"
            description="Crie seu primeiro projeto para começar a organizar seu trabalho."
            action={
              <Button onClick={handleNewProject} disabled={creating}>
                <PlusIcon className="h-4 w-4" />
                {creating ? "Criando..." : "Criar projeto"}
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
            {creating ? "Criando..." : "Novo projeto"}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchInput
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar projetos..."
          className="w-full sm:w-60"
        />
        <select
          value={responsavelFiltro}
          onChange={(e) => setResponsavelFiltro(e.target.value)}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Todos os responsáveis</option>
          {criadores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.username}
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
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
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
            title="Não encontramos nenhum projeto."
            description="Experimente alterar sua busca ou filtro."
            action={
              <Button variant="secondary" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetosFiltrados.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              avatarUrl={
                project.created_by
                  ? avatarPorCriador.get(project.created_by)
                  : null
              }
              onRename={() => handleRename(project)}
              onDelete={() => handleDelete(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  avatarUrl,
  onRename,
  onDelete,
}: {
  project: Project;
  avatarUrl: string | null | undefined;
  onRename: () => void;
  onDelete: () => void;
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

  return (
    <div className="group relative rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <Link href={`/projetos/${project.id}`} className="block">
        <p className="pr-7 text-base font-semibold leading-snug text-ink">
          {project.name}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Quadro de tarefas e Wiki próprios
        </p>

        {project.created_by_label && (
          <div className="mt-4 flex items-center gap-2">
            <Avatar name={project.created_by_label} src={avatarUrl} size="sm" />
            <span className="text-xs text-ink-muted">
              {project.created_by_label}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-xs text-ink-muted">
            {formatarRelativo(project.created_at)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
            Abrir projeto
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>

      <div ref={menuRef} className="absolute right-2.5 top-2.5">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuAberto((v) => !v);
          }}
          title="Ações do projeto"
          aria-label="Ações do projeto"
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          data-open={menuAberto}
          className="rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-ink group-hover:opacity-100 data-[open=true]:opacity-100"
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </button>

        {menuAberto && (
          <div
            role="menu"
            className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-dropdown"
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
