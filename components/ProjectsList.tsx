"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project } from "@/lib/types";

export default function ProjectsList({
  initialProjects,
  currentUserId = null,
  currentUserLabel = "",
  verTudo = false,
  profiles = [],
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
}) {
  const supabase = createClient();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [creating, setCreating] = useState(false);

  const [busca, setBusca] = useState("");
  const [dataFiltro, setDataFiltro] = useState("");

  const avatarPorCriador = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.avatar_url])),
    [profiles]
  );

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return projects.filter((project) => {
      if (termo) {
        const nomeBate = project.name.toLowerCase().includes(termo);
        const pessoaBate = (project.created_by_label ?? "")
          .toLowerCase()
          .includes(termo);
        if (!nomeBate && !pessoaBate) return false;
      }
      if (dataFiltro) {
        const dataProjeto = project.created_at.slice(0, 10);
        if (dataProjeto !== dataFiltro) return false;
      }
      return true;
    });
  }, [projects, busca, dataFiltro]);

  const temFiltroAtivo = busca.trim() !== "" || dataFiltro !== "";

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

  async function handleDelete(project: Project) {
    const confirmado = window.confirm(
      `Excluir o projeto "${project.name}"? As tarefas e páginas dele voltam para o quadro/wiki "Geral" — nada é apagado.`
    );
    if (!confirmado) return;

    setProjects((current) => current.filter((p) => p.id !== project.id));
    await supabase.from("projects").delete().eq("id", project.id);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <button
          onClick={handleNewProject}
          disabled={creating}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? "Criando..." : "+ Novo projeto"}
        </button>

        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">
              Buscar por projeto ou pessoa
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: dashboard, erick..."
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Data</label>
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            />
          </div>
          {temFiltroAtivo && (
            <button
              onClick={() => {
                setBusca("");
                setDataFiltro("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {projetosFiltrados.map((project) => {
          const avatarUrl = project.created_by
            ? avatarPorCriador.get(project.created_by)
            : null;
          return (
            <div
              key={project.id}
              className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <Link href={`/projetos/${project.id}`} className="block">
                <p className="pr-6 text-sm font-semibold text-slate-800">
                  {project.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Quadro de tarefas e Wiki próprios
                </p>
                {project.created_by_label && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[10px] font-semibold text-white">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        project.created_by_label.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <p className="text-xs text-slate-400">
                      por {project.created_by_label}
                    </p>
                  </div>
                )}
              </Link>
              <button
                onClick={() => handleDelete(project)}
                title="Excluir projeto"
                className="absolute right-3 top-3 text-xs text-slate-300 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          );
        })}
        {projetosFiltrados.length === 0 && projects.length > 0 && (
          <p className="text-sm text-slate-400">
            Nenhum projeto encontrado com esse filtro.
          </p>
        )}
        {projects.length === 0 && (
          <p className="text-sm text-slate-400">
            Nenhum projeto ainda. Crie o primeiro.
          </p>
        )}
      </div>
    </div>
  );
}
