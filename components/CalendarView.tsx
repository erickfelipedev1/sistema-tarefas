"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types";
import { corTarefa } from "@/lib/task-colors";
import TaskModal from "./TaskModal";
import { Button } from "./ui/Button";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "./ui/icons";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Quantos eventos mostrar antes de resumir em "+N mais" — evita que um dia
// lotado estoure a altura da célula.
const MAX_EVENTOS_VISIVEIS = 3;

// Monta a chave "AAAA-MM-DD" a partir de um Date local (nunca usar
// toISOString aqui — ele converte pra UTC e pode mostrar o dia errado
// dependendo do fuso horário de quem está usando).
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// Sempre 42 células (6 semanas), começando no domingo da semana do dia 1.
function buildGrid(ano: number, mes: number) {
  const primeiroDoMes = new Date(ano, mes, 1);
  const offset = primeiroDoMes.getDay();
  const inicioGrade = new Date(ano, mes, 1 - offset);

  const celulas: { date: Date; noMesAtual: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrade);
    d.setDate(inicioGrade.getDate() + i);
    celulas.push({ date: d, noMesAtual: d.getMonth() === mes });
  }
  return celulas;
}

export default function CalendarView({
  initialTasks,
  currentUserId,
  currentUserLabel,
  verTudo = false,
  projects = [],
  profiles = [],
  title,
  subtitle,
}: {
  initialTasks: Task[];
  // Usado pra filtrar o que chega em tempo real, além do que já veio
  // filtrado do servidor.
  currentUserId: string | null;
  currentUserLabel: string;
  // Quem tem "ve_tudo" (hoje só a Emily) não filtra nada — vê o calendário
  // de todo mundo.
  verTudo?: boolean;
  // Mesmos dados que o quadro de Tarefas usa — reaproveitados aqui pra abrir
  // o mesmo modal de criar/editar tarefa a partir do calendário.
  projects?: Project[];
  profiles?: Profile[];
  title?: string;
  subtitle?: string;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [busca, setBusca] = useState("");

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Task | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // Mesma regra usada na busca inicial (servidor) e no realtime: só entra
  // no calendário quem tem prazo e é "meu" (ou tudo, se verTudo).
  function deveAparecer(t: Task) {
    if (!t.due_date) return false;
    return (
      verTudo ||
      t.created_by === currentUserId ||
      (!!currentUserId && t.assigned_to.includes(currentUserId))
    );
  }

  useEffect(() => {
    const channel = supabase
      .channel("calendar-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Task;
              if (!deveAparecer(novo)) return current;
              if (current.some((t) => t.id === novo.id)) return current;
              return [...current, novo];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Task;
              if (!deveAparecer(atualizado)) {
                return current.filter((t) => t.id !== atualizado.id);
              }
              const existe = current.some((t) => t.id === atualizado.id);
              return existe
                ? current.map((t) =>
                    t.id === atualizado.id ? atualizado : t
                  )
                : [...current, atualizado];
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
  }, [currentUserId, verTudo]);

  const celulas = useMemo(() => buildGrid(ano, mes), [ano, mes]);

  const tasksPorDia = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const mapa: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      if (termo && !t.title.toLowerCase().includes(termo)) return;
      if (!mapa[t.due_date]) mapa[t.due_date] = [];
      mapa[t.due_date].push(t);
    });
    return mapa;
  }, [tasks, busca]);

  // Pra saber se vale mostrar o aviso discreto de "calendário livre" embaixo
  // da grade — só olha os dias que pertencem ao mês em exibição.
  const mesTemEventos = useMemo(
    () =>
      celulas.some(
        ({ date, noMesAtual }) =>
          noMesAtual && (tasksPorDia[dateKey(date)]?.length ?? 0) > 0
      ),
    [celulas, tasksPorDia]
  );

  function irParaMesAnterior() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  }

  function irParaProximoMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  }

  function irParaHoje() {
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth());
  }

  function abrirCriarNoDia(dateStr: string) {
    setTarefaEditando(null);
    setDiaSelecionado(dateStr);
    setModalAberto(true);
  }

  function abrirEditar(task: Task) {
    setTarefaEditando(task);
    setDiaSelecionado(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setTarefaEditando(null);
    setDiaSelecionado(null);
  }

  function handleCreated(nova: Task) {
    if (!deveAparecer(nova)) return;
    setTasks((current) =>
      current.some((t) => t.id === nova.id) ? current : [...current, nova]
    );
  }

  function handleUpdated(atualizada: Task) {
    setTasks((current) => {
      if (!deveAparecer(atualizada)) {
        return current.filter((t) => t.id !== atualizada.id);
      }
      const existe = current.some((t) => t.id === atualizada.id);
      return existe
        ? current.map((t) => (t.id === atualizada.id ? atualizada : t))
        : [...current, atualizada];
    });
  }

  function handleDeleted(taskId: string) {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }

  // As tarefas criadas pelo calendário sempre entram no topo da coluna —
  // mesmo comportamento simples que já existia antes.
  function getNextPosition(_status: TaskStatus) {
    return 0;
  }

  async function handleDeleteTask(e: React.MouseEvent, task: Task) {
    e.stopPropagation();
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return;
    setTasks((current) => current.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  const hojeKey = dateKey(hoje);

  return (
    <div>
      <PageHeader
        title={title ?? "Meu calendário"}
        subtitle={subtitle ?? "Veja e organize seus compromissos e tarefas."}
        actions={
          <>
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar eventos..."
              className="w-full sm:w-56"
            />
            <Button onClick={() => abrirCriarNoDia(hojeKey)}>
              <PlusIcon className="h-4 w-4" />
              Novo evento
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink sm:text-lg">
            {MESES[mes]} {ano}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={irParaMesAnterior}
                aria-label="Mês anterior"
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <Button variant="secondary" size="sm" onClick={irParaHoje}>
                Hoje
              </Button>
              <button
                onClick={irParaProximoMes}
                aria-label="Próximo mês"
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
              <button className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-navy">
                Mês
              </button>
              <button
                disabled
                title="Em breve"
                className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-ink-muted"
              >
                Semana
              </button>
              <button
                disabled
                title="Em breve"
                className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-ink-muted"
              >
                Dia
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="bg-canvas px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
              >
                {dia}
              </div>
            ))}

            {celulas.map(({ date, noMesAtual }) => {
              const key = dateKey(date);
              const tarefasDoDia = tasksPorDia[key] ?? [];
              const ehHoje = key === hojeKey;
              const fimDeSemana = date.getDay() === 0 || date.getDay() === 6;

              const visiveis = tarefasDoDia.slice(0, MAX_EVENTOS_VISIVEIS);
              const extras = tarefasDoDia.length - visiveis.length;

              let cellBg = "bg-surface hover:bg-canvas/70";
              if (!noMesAtual) cellBg = "bg-canvas/40 hover:bg-canvas/70";
              else if (fimDeSemana) cellBg = "bg-canvas/40 hover:bg-canvas/70";

              return (
                <div
                  key={key}
                  onClick={() => abrirCriarNoDia(key)}
                  className={`group relative min-h-[108px] cursor-pointer p-1.5 transition-colors ${cellBg}`}
                  title="Clique para criar uma tarefa neste dia"
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      ehHoje
                        ? "bg-brand font-semibold text-navy"
                        : noMesAtual
                        ? "font-medium text-ink"
                        : "text-ink-muted"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {visiveis.map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirEditar(task);
                        }}
                        className="group/chip flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface-hover"
                      >
                        <span
                          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                            corTarefa(task.color).dot
                          }`}
                        />
                        <span
                          className={`flex-1 truncate text-[11px] ${
                            task.status === "done"
                              ? "text-ink-muted line-through"
                              : "text-ink"
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.due_time && (
                          <span className="hidden flex-shrink-0 text-[10px] text-ink-muted sm:inline">
                            {task.due_time.slice(0, 5)}
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeleteTask(e, task)}
                          title="Excluir tarefa"
                          className="hidden flex-shrink-0 text-ink-muted hover:text-danger group-hover/chip:inline-flex"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {extras > 0 && (
                      <p className="px-1 text-[10px] text-ink-muted">
                        +{extras} mais
                      </p>
                    )}
                  </div>

                  {tarefasDoDia.length === 0 && (
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 text-[10px] font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                      + Adicionar
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!mesTemEventos && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            {busca
              ? "Nenhum evento encontrado com esse termo."
              : "Seu calendário está livre neste mês."}
          </p>
        )}
      </div>

      {modalAberto && (
        <TaskModal
          task={tarefaEditando}
          projectId={null}
          projects={projects}
          profiles={profiles}
          currentUserLabel={currentUserLabel}
          getNextPosition={getNextPosition}
          initialDueDate={diaSelecionado}
          onClose={fecharModal}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
