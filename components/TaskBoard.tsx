"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types";
import { corTarefa } from "@/lib/task-colors";
import { buildTaskSummaryBlocks, syncTaskWiki } from "@/lib/task-wiki-sync";
import TaskModal from "./TaskModal";

const COLUNAS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Em Andamento" },
  { key: "done", label: "Concluído" },
  { key: "cancelled", label: "Cancelada" },
];

export default function TaskBoard({
  initialTasks,
  currentUserId = null,
  currentUserLabel,
  projectId = null,
  allProjects = false,
  soMinhas = false,
  projects = [],
  profiles = [],
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
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Task | null>(null);

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const profilesById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.name || p.username || "?"])),
    [profiles]
  );

  // Se o quadro é individual (soMinhas), só deixa entrar uma tarefa que eu
  // criei ou que foi atribuída a mim.
  function minha(task: Task) {
    if (!soMinhas) return true;
    return task.created_by === currentUserId || task.assigned_to === currentUserId;
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

  return (
    <div>
      <button
        onClick={abrirCriar}
        className="mb-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        + Nova tarefa
      </button>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS.map((coluna) => (
          <div
            key={coluna.key}
            onDragOver={(e) => handleColumnDragOver(e, coluna.key)}
            onDragLeave={() => handleColumnDragLeave(coluna.key)}
            onDrop={(e) => handleDrop(e, coluna.key)}
            className={`rounded-2xl bg-white p-4 shadow-sm transition-colors ${
              dragOverCol === coluna.key
                ? "ring-2 ring-slate-400 ring-offset-2"
                : ""
            }`}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {coluna.label} (
              {tasks.filter((t) => t.status === coluna.key).length})
            </h2>
            <div className="space-y-3">
              {tasks
                .filter((t) => t.status === coluna.key)
                .map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-xl border border-l-4 border-slate-200 p-3 active:cursor-grabbing ${
                      corTarefa(task.color).borda
                    } ${draggedId === task.id ? "opacity-40" : ""}`}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {task.title}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {allProjects && task.project_id && (
                        <Link
                          href={`/projetos/${task.project_id}`}
                          className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200"
                        >
                          {projectsById.get(task.project_id) ?? "Projeto"}
                        </Link>
                      )}
                      {task.assigned_to && (
                        <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
                          👤 {profilesById.get(task.assigned_to) ?? "?"}
                        </span>
                      )}
                    </div>

                    {(task.due_date || task.created_by_label) && (
                      <p className="mt-1 text-xs text-slate-400">
                        {task.due_date && (
                          <>
                            📅 {task.due_date.split("-").reverse().join("/")}
                            {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
                            {task.created_by_label ? " · " : ""}
                          </>
                        )}
                        {task.created_by_label && `por ${task.created_by_label}`}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => abrirEditar(task)}
                        className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                      >
                        ✏️ Abrir
                      </button>
                      <button
                        onClick={() => abrirWiki(task)}
                        className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                      >
                        {task.page_id ? "📄 Wiki" : "📄 Criar página"}
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveTask(task, -1)}
                          disabled={coluna.key === COLUNAS[0].key}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveTask(task, 1)}
                          disabled={coluna.key === COLUNAS[COLUNAS.length - 1].key}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                      <button
                        onClick={() => deleteTask(task)}
                        title="Excluir tarefa"
                        className="text-sm text-slate-400 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              {tasks.filter((t) => t.status === coluna.key).length === 0 && (
                <p className="text-xs text-slate-400">Nenhuma tarefa aqui.</p>
              )}
            </div>
          </div>
        ))}
      </div>

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
