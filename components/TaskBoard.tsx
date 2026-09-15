"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types";
import { corTarefa } from "@/lib/task-colors";
import { buildTaskSummaryBlocks, syncTaskWiki } from "@/lib/task-wiki-sync";
import TaskModal from "./TaskModal";
import { Avatar } from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import { StatTile } from "./ui/StatTile";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileStackIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "./ui/icons";

const COLUNAS: { key: TaskStatus; label: string; dot: string }[] = [
  { key: "todo", label: "A Fazer", dot: "bg-brand" },
  { key: "doing", label: "Em Andamento", dot: "bg-warning" },
  { key: "done", label: "Concluído", dot: "bg-success" },
  { key: "cancelled", label: "Cancelada", dot: "bg-slate-400" },
];

// Data de hoje no formato "AAAA-MM-DD" (igual ao due_date), respeitando o
// fuso horário local em vez de UTC.
function hojeISO() {
  return new Date().toLocaleDateString("en-CA");
}

export default function TaskBoard({
  initialTasks,
  currentUserId = null,
  currentUserLabel,
  projectId = null,
  allProjects = false,
  soMinhas = false,
  projects = [],
  profiles = [],
  title,
  subtitle,
  showHeader = true,
}: {
  initialTasks: Task[];
  // Só é usado quando soMinhas=true, pra filtrar o que chega em tempo real.
  currentUserId?: string | null;
  currentUserLabel: string;
  // Quadro de um único projeto (ou "Geral", quando null).
  projectId?: string | null;
  // Quadro principal: mostra tarefas de todos os projetos juntas, cada
  // uma com uma etiqueta indicando de qual projeto ela é.
  allProjects?: boolean;
  // Quadro individual: só mostra as tarefas que eu criei ou que foram
  // atribuídas a mim (usado no quadro principal — dentro de um projeto
  // específico o quadro continua mostrando todo mundo).
  soMinhas?: boolean;
  projects?: Project[];
  profiles?: Profile[];
  // Cabeçalho completo (título, resumo em números, busca e filtro) — usado
  // na tela "Minhas tarefas". Dentro de um projeto específico o quadro fica
  // mais enxuto (showHeader=false), já que a página ali tem seu próprio
  // título.
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Task | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  function nomeDe(id: string) {
    const p = profileById.get(id);
    return p?.name || p?.username || "?";
  }

  // Se o quadro é individual (soMinhas), só deixa entrar uma tarefa que eu
  // criei ou que foi atribuída a mim.
  function minha(task: Task) {
    if (!soMinhas) return true;
    return (
      task.created_by === currentUserId ||
      (!!currentUserId && task.assigned_to.includes(currentUserId))
    );
  }

  // Mantém o quadro sincronizado em tempo real entre todos que estiverem
  // logados ao mesmo tempo (exige Realtime habilitado na tabela "tasks").
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-realtime-${allProjects ? "all" : projectId ?? "geral"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Task;
              // Num quadro de projeto único, só entra se for deste mesmo
              // projeto (ou "Geral"). No quadro principal, entra sempre.
              if (!allProjects && (novo.project_id ?? null) !== projectId) {
                return current;
              }
              if (!minha(novo)) return current;
              if (current.some((t) => t.id === novo.id)) return current;
              return [...current, novo];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Task;
              if (
                (!allProjects && (atualizado.project_id ?? null) !== projectId) ||
                !minha(atualizado)
              ) {
                // Se a tarefa foi movida pra outro projeto, ou deixou de ser
                // minha (reatribuída pra outra pessoa), ela some do quadro.
                return current.filter((t) => t.id !== atualizado.id);
              }
              const jaEstava = current.some((t) => t.id === atualizado.id);
              if (!jaEstava) return [...current, atualizado];
              return current.map((t) =>
                t.id === atualizado.id ? atualizado : t
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Task).id;
              return current.filter((t) => t.id !== removidoId);
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
  }, [projectId, allProjects, soMinhas, currentUserId]);

  function getNextPosition(status: TaskStatus) {
    const maxPosition = tasks
      .filter((t) => t.status === status)
      .reduce((max, t) => Math.max(max, t.position), 0);
    return maxPosition + 1;
  }

  function abrirCriar() {
    setTarefaEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(task: Task) {
    setTarefaEditando(task);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setTarefaEditando(null);
  }

  function handleCreated(nova: Task) {
    setTasks((current) =>
      current.some((t) => t.id === nova.id) ? current : [...current, nova]
    );
  }

  function handleUpdated(atualizada: Task) {
    setTasks((current) =>
      current.map((t) => (t.id === atualizada.id ? atualizada : t))
    );
  }

  function handleDeleted(taskId: string) {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }

  async function moveTaskTo(task: Task, novoStatus: TaskStatus) {
    if (task.status === novoStatus) return;

    const maxPosition = tasks
      .filter((t) => t.status === novoStatus)
      .reduce((max, t) => Math.max(max, t.position), 0);

    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? { ...t, status: novoStatus, position: maxPosition + 1 }
          : t
      )
    );

    await supabase
      .from("tasks")
      .update({ status: novoStatus, position: maxPosition + 1 })
      .eq("id", task.id);

    // Arrastar entre colunas também muda o status — se a tarefa tem página
    // na Wiki, o resumo lá precisa acompanhar.
    if (task.page_id) {
      syncTaskWiki(
        supabase,
        { ...task, status: novoStatus, position: maxPosition + 1 },
        profiles,
        projects
      ).catch(() => {
        // Falha silenciosa: a tarefa já mudou de coluna, só o resumo na
        // Wiki que não atualizou dessa vez.
      });
    }
  }

  async function moveTask(task: Task, direction: -1 | 1) {
    const index = COLUNAS.findIndex((c) => c.key === task.status);
    const novoIndex = index + direction;
    if (novoIndex < 0 || novoIndex >= COLUNAS.length) return;
    await moveTaskTo(task, COLUNAS[novoIndex].key);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    setDraggedId(task.id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverCol(null);
  }

  function handleColumnDragOver(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  }

  function handleColumnDragLeave(colKey: TaskStatus) {
    setDragOverCol((atual) => (atual === colKey ? null : atual));
  }

  async function handleDrop(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await moveTaskTo(task, colKey);
  }

  async function deleteTask(task: Task) {
    const confirmado = window.confirm(
      `Tem certeza que quer excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setTasks((current) => current.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  // Abre a "página na Wiki" da tarefa — cria a página na hora, na primeira
  // vez, e depois é só reabrir a mesma. Isso é separado do modal de
  // detalhes: aqui é uma página de texto livre da Wiki.
  async function abrirWiki(task: Task) {
    if (task.page_id) {
      router.push(`/wiki/${task.page_id}`);
      return;
    }

    const { data, error } = await supabase
      .from("pages")
      .insert({
        title: task.title,
        // Já cria com o resumo da tarefa (status, data, responsável, etc)
        // no topo — o resto da página fica livre pra escrever.
        content: buildTaskSummaryBlocks(task, profiles, projects),
        project_id: task.project_id ?? null,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (error || !data) {
      window.alert("Não deu pra criar a página da Wiki. Tenta de novo.");
      return;
    }

    const { error: erroVinculo } = await supabase
      .from("tasks")
      .update({ page_id: data.id })
      .eq("id", task.id);

    if (erroVinculo) {
      window.alert(
        "A página foi criada, mas não consegui vincular ela à tarefa. Confere se a migration 0011_task_wiki_link.sql já foi rodada no Supabase."
      );
    } else {
      setTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, page_id: data.id } : t))
      );
    }
    router.push(`/wiki/${data.id}`);
  }

  const hoje = hojeISO();

  // Resumo em números — sempre reflete todas as tarefas do quadro, mesmo
  // que a busca/filtro abaixo esteja escondendo algumas nas colunas.
  const resumo = useMemo(() => {
    const abertas = tasks.filter(
      (t) => t.status === "todo" || t.status === "doing"
    ).length;
    const paraHoje = tasks.filter(
      (t) =>
        t.due_date === hoje && t.status !== "done" && t.status !== "cancelled"
    ).length;
    const atrasadas = tasks.filter(
      (t) =>
        !!t.due_date &&
        t.due_date < hoje &&
        t.status !== "done" &&
        t.status !== "cancelled"
    ).length;
    const concluidas = tasks.filter((t) => t.status === "done").length;
    return { abertas, paraHoje, atrasadas, concluidas };
  }, [tasks, hoje]);

  // Quem já foi responsável por alguma tarefa aqui — usado pra montar o
  // filtro, em vez de listar todo mundo do sistema.
  const responsaveisNoQuadro = useMemo(() => {
    const ids = new Set(tasks.flatMap((t) => t.assigned_to));
    return Array.from(ids)
      .map((id) => profileById.get(id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) => (a.name || a.username || "").localeCompare(b.name || b.username || ""));
  }, [tasks, profileById]);

  const tasksVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return tasks.filter((t) => {
      if (termo && !t.title.toLowerCase().includes(termo)) return false;
      if (filtroResponsavel && !t.assigned_to.includes(filtroResponsavel)) {
        return false;
      }
      return true;
    });
  }, [tasks, busca, filtroResponsavel]);

  return (
    <div>
      {showHeader ? (
        <>
          <PageHeader
            title={title ?? "Minhas tarefas"}
            subtitle={
              subtitle ?? "Organize seu dia e acompanhe o que precisa ser feito."
            }
            actions={
              <>
                <SearchInput
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar tarefas..."
                  className="w-full sm:w-56"
                />
                <select
                  value={filtroResponsavel}
                  onChange={(e) => setFiltroResponsavel(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  <option value="">Todos os responsáveis</option>
                  {responsaveisNoQuadro.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.username}
                    </option>
                  ))}
                </select>
                <Button onClick={abrirCriar}>
                  <PlusIcon className="h-4 w-4" />
                  Nova tarefa
                </Button>
              </>
            }
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={<ClipboardListIcon className="h-4 w-4" />}
              value={resumo.abertas}
              label="Tarefas abertas"
              tone="brand"
            />
            <StatTile
              icon={<CalendarIcon className="h-4 w-4" />}
              value={resumo.paraHoje}
              label="Para hoje"
              tone="warning"
            />
            <StatTile
              icon={<AlertTriangleIcon className="h-4 w-4" />}
              value={resumo.atrasadas}
              label="Atrasadas"
              tone="danger"
            />
            <StatTile
              icon={<CheckCircleIcon className="h-4 w-4" />}
              value={resumo.concluidas}
              label="Concluídas"
              tone="success"
            />
          </div>
        </>
      ) : (
        <Button size="sm" onClick={abrirCriar} className="mb-4">
          <PlusIcon className="h-3.5 w-3.5" />
          Nova tarefa
        </Button>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin xl:grid xl:grid-cols-4 xl:overflow-visible">
        {COLUNAS.map((coluna) => {
          const tarefasDaColuna = tasksVisiveis.filter(
            (t) => t.status === coluna.key
          );
          return (
            <div
              key={coluna.key}
              onDragOver={(e) => handleColumnDragOver(e, coluna.key)}
              onDragLeave={() => handleColumnDragLeave(coluna.key)}
              onDrop={(e) => handleDrop(e, coluna.key)}
              className={`min-w-[270px] flex-shrink-0 rounded-2xl p-1.5 transition-colors xl:min-w-0 ${
                dragOverCol === coluna.key ? "bg-brand/5 ring-2 ring-brand/30" : ""
              }`}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${coluna.dot}`} />
                <h2 className="text-sm font-semibold text-ink">{coluna.label}</h2>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                  {tarefasDaColuna.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {tarefasDaColuna.map((task) => {
                  const atrasada =
                    !!task.due_date &&
                    task.due_date < hoje &&
                    task.status !== "done" &&
                    task.status !== "cancelled";
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => abrirEditar(task)}
                      className={`group cursor-pointer rounded-xl border border-line border-l-[3px] bg-white p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        corTarefa(task.color).borda
                      } ${draggedId === task.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug text-ink">
                          {task.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task);
                          }}
                          title="Excluir tarefa"
                          className="flex-shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {(allProjects && task.project_id) ||
                      task.assigned_to.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {allProjects && task.project_id && (
                            <Link
                              href={`/projetos/${task.project_id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Badge tone="neutral">
                                {projectsById.get(task.project_id) ?? "Projeto"}
                              </Badge>
                            </Link>
                          )}
                          {task.assigned_to.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {task.assigned_to.slice(0, 3).map((id) => (
                                <Avatar
                                  key={id}
                                  name={nomeDe(id)}
                                  src={profileById.get(id)?.avatar_url}
                                  size="xs"
                                  className="ring-2 ring-white"
                                />
                              ))}
                              {task.assigned_to.length > 3 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-ink-muted ring-2 ring-white">
                                  +{task.assigned_to.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {(task.due_date || task.created_by_label) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                          {task.due_date && (
                            <span
                              className={`flex items-center gap-1 ${
                                atrasada ? "font-medium text-danger" : ""
                              }`}
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {task.due_date.split("-").reverse().join("/")}
                              {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
                            </span>
                          )}
                          {task.created_by_label && (
                            <span className="truncate">
                              por {task.created_by_label}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(task, -1);
                            }}
                            disabled={coluna.key === COLUNAS[0].key}
                            title="Mover para a coluna anterior"
                            className="rounded-md p-1 text-ink-muted hover:bg-slate-100 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronLeftIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(task, 1);
                            }}
                            disabled={coluna.key === COLUNAS[COLUNAS.length - 1].key}
                            title="Mover para a próxima coluna"
                            className="rounded-md p-1 text-ink-muted hover:bg-slate-100 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirWiki(task);
                          }}
                          title={task.page_id ? "Abrir na Wiki" : "Criar página na Wiki"}
                          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-muted hover:bg-slate-100 hover:text-ink"
                        >
                          <FileStackIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {tarefasDaColuna.length === 0 && (
                  <EmptyState
                    icon={<SparklesIcon className="h-4 w-4" />}
                    title={
                      busca || filtroResponsavel
                        ? "Nada por aqui"
                        : "Tudo limpo por aqui"
                    }
                    description={
                      busca || filtroResponsavel
                        ? "Nenhuma tarefa bate com o filtro atual."
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showHeader && tasks.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white px-6 py-7 text-center">
          <SparklesIcon className="h-5 w-5 text-brand" />
          <p className="text-sm font-medium text-ink">Seu dia está livre ✨</p>
          <p className="text-xs text-ink-muted">
            Crie uma tarefa para começar a organizar seu trabalho.
          </p>
          <Button size="sm" variant="secondary" onClick={abrirCriar} className="mt-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            Criar tarefa
          </Button>
        </div>
      )}

      {modalAberto && (
        <TaskModal
          task={tarefaEditando}
          projectId={projectId}
          projects={projects}
          profiles={profiles}
          currentUserLabel={currentUserLabel}
          getNextPosition={getNextPosition}
          onClose={fecharModal}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
