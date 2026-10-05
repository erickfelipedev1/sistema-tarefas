"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const DIAS_SEMANA_LONGO = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

// Quantos eventos mostrar antes de resumir em "+N mais" — evita que um dia
// lotado estoure a altura da célula.
const MAX_EVENTOS_VISIVEIS = 3;

// Visões Semana e Dia: uma linha por hora. Abre rolada até as 7h.
const HORAS = Array.from({ length: 24 }, (_, h) => h);
const HORA_INICIAL_VISIVEL = 7;
const ALTURA_HORA = 56; // px

type Visao = "mes" | "semana" | "dia";

// Monta a chave "AAAA-MM-DD" a partir de um Date local (nunca usar
// toISOString aqui — ele converte pra UTC e pode mostrar o dia errado
// dependendo do fuso horário de quem está usando).
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDias(d: Date, n: number) {
  const nova = new Date(d);
  nova.setDate(d.getDate() + n);
  return nova;
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

// Domingo a sábado da semana do dia.
function diasDaSemana(d: Date) {
  const domingo = somarDias(d, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
}

function tituloDaVisao(visao: Visao, ref: Date) {
  if (visao === "mes") return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`;
  if (visao === "dia") {
    return `${DIAS_SEMANA_LONGO[ref.getDay()]}, ${ref.getDate()} de ${MESES[
      ref.getMonth()
    ].toLowerCase()} de ${ref.getFullYear()}`;
  }
  const dias = diasDaSemana(ref);
  const ini = dias[0];
  const fim = dias[6];
  if (ini.getMonth() === fim.getMonth()) {
    return `${ini.getDate()} – ${fim.getDate()} de ${MESES[fim.getMonth()].toLowerCase()} de ${fim.getFullYear()}`;
  }
  const curto = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
  return `${curto(ini)} – ${curto(fim)} de ${fim.getFullYear()}`;
}

// Dias do período da tarefa (início → entrega), em "AAAA-MM-DD". Sem início,
// só o dia da entrega. Limite de 120 dias pra um período errado não travar.
function diasDoPeriodo(t: Task): string[] {
  if (!t.due_date) return [];
  if (!t.start_date || t.start_date >= t.due_date) return [t.due_date];
  const dias: string[] = [];
  const d = new Date(`${t.start_date}T12:00:00`);
  const fim = new Date(`${t.due_date}T12:00:00`);
  while (d <= fim && dias.length < 120) {
    dias.push(d.toLocaleDateString("en-CA"));
    d.setDate(d.getDate() + 1);
  }
  if (dias[dias.length - 1] !== t.due_date) dias.push(t.due_date);
  return dias;
}

// Horário só conta no dia da entrega; nos outros dias do período a tarefa
// aparece em "Dia todo".
function horaDaTarefa(t: Task, dia?: string): number | null {
  if (dia && dia !== t.due_date) return null;
  if (!t.due_time) return null;
  const h = Number(t.due_time.slice(0, 2));
  return Number.isFinite(h) ? h : null;
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
  // Quem tem "ve_tudo" não filtra nada — vê o calendário de todo mundo.
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
  // Líderes (verTudo): de quem ver o calendário. "" = todo mundo.
  const [pessoaFiltro, setPessoaFiltro] = useState("");

  const hoje = new Date();
  const [visao, setVisao] = useState<Visao>("mes");
  // Dia de referência: o mês/semana/dia mostrado é o que contém esta data.
  const [dataRef, setDataRef] = useState(() => new Date());
  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();

  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Task | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);

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
      // Pessoa escolhida: é responsável, ou criou e não tem responsável.
      if (
        pessoaFiltro &&
        !t.assigned_to.includes(pessoaFiltro) &&
        !(t.assigned_to.length === 0 && t.created_by === pessoaFiltro)
      ) {
        return;
      }
      for (const dia of diasDoPeriodo(t)) {
        if (!mapa[dia]) mapa[dia] = [];
        mapa[dia].push(t);
      }
    });
    // Dentro do dia: sem horário primeiro, depois por horário.
    Object.values(mapa).forEach((lista) =>
      lista.sort((a, b) => (a.due_time ?? "").localeCompare(b.due_time ?? ""))
    );
    return mapa;
  }, [tasks, busca, pessoaFiltro]);

  // Dias mostrados na visão atual (pro aviso de "calendário livre").
  const diasVisiveis = useMemo(() => {
    if (visao === "dia") return [dataRef];
    if (visao === "semana") return diasDaSemana(dataRef);
    return celulas.filter((c) => c.noMesAtual).map((c) => c.date);
  }, [visao, dataRef, celulas]);

  const temEventos = diasVisiveis.some(
    (d) => (tasksPorDia[dateKey(d)]?.length ?? 0) > 0
  );

  function andar(direcao: -1 | 1) {
    setDataRef((atual) => {
      if (visao === "mes") return new Date(atual.getFullYear(), atual.getMonth() + direcao, 1);
      return somarDias(atual, visao === "semana" ? 7 * direcao : direcao);
    });
  }

  function irParaHoje() {
    setDataRef(new Date());
  }

  function abrirCriar(dateStr: string, hora: number | null = null) {
    setTarefaEditando(null);
    setDiaSelecionado(dateStr);
    setHoraSelecionada(hora === null ? null : `${String(hora).padStart(2, "0")}:00`);
    setModalAberto(true);
  }

  function abrirEditar(task: Task) {
    setTarefaEditando(task);
    setDiaSelecionado(null);
    setHoraSelecionada(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setTarefaEditando(null);
    setDiaSelecionado(null);
    setHoraSelecionada(null);
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

  function nomeDaPessoa(id: string) {
    const p = profiles.find((x) => x.id === id);
    return p?.name || p?.username || "alguém";
  }

  const hojeKey = dateKey(hoje);
  const rotuloPeriodo = { mes: "mês", semana: "semana", dia: "dia" }[visao];

  return (
    <div>
      <PageHeader
        title={
          pessoaFiltro
            ? pessoaFiltro === currentUserId
              ? "Meu calendário"
              : `Calendário de ${nomeDaPessoa(pessoaFiltro)}`
            : title ?? "Meu calendário"
        }
        subtitle={subtitle ?? "Veja e organize seus compromissos e tarefas."}
        actions={
          <>
            {verTudo && (
              <select
                value={pessoaFiltro}
                onChange={(e) => setPessoaFiltro(e.target.value)}
                aria-label="Ver o calendário de"
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none sm:w-52"
              >
                <option value="">Todo mundo</option>
                {currentUserId && <option value={currentUserId}>Eu</option>}
                {profiles
                  .filter((p) => p.id !== currentUserId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.username || "Sem nome"}
                    </option>
                  ))}
              </select>
            )}
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar eventos..."
              className="w-full sm:w-56"
            />
            <Button onClick={() => abrirCriar(visao === "mes" ? hojeKey : dateKey(dataRef))}>
              <PlusIcon className="h-4 w-4" />
              Novo evento
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink sm:text-lg">
            {tituloDaVisao(visao, dataRef)}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => andar(-1)}
                aria-label={`${rotuloPeriodo === "semana" ? "Semana anterior" : rotuloPeriodo === "dia" ? "Dia anterior" : "Mês anterior"}`}
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <Button variant="secondary" size="sm" onClick={irParaHoje}>
                Hoje
              </Button>
              <button
                onClick={() => andar(1)}
                aria-label={`${rotuloPeriodo === "semana" ? "Próxima semana" : rotuloPeriodo === "dia" ? "Próximo dia" : "Próximo mês"}`}
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div
              className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
              role="group"
              aria-label="Visualização"
            >
              {(
                [
                  ["mes", "Mês"],
                  ["semana", "Semana"],
                  ["dia", "Dia"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  onClick={() => setVisao(valor)}
                  aria-pressed={visao === valor}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    visao === valor
                      ? "bg-brand text-navy"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visao === "mes" ? (
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
                    onClick={() => abrirCriar(key)}
                    className={`group relative min-h-[108px] cursor-pointer p-1.5 transition-colors ${cellBg}`}
                    title="Clique para criar uma tarefa neste dia"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDataRef(date);
                        setVisao("dia");
                      }}
                      title="Ver o dia"
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs hover:ring-2 hover:ring-brand/40 ${
                        ehHoje
                          ? "bg-brand font-semibold text-navy"
                          : noMesAtual
                          ? "font-medium text-ink"
                          : "text-ink-muted"
                      }`}
                    >
                      {date.getDate()}
                    </button>

                    <div className="mt-1 space-y-0.5">
                      {visiveis.map((task) => (
                        <ChipTarefa
                          key={task.id}
                          dia={key}
                          task={task}
                          onAbrir={() => abrirEditar(task)}
                          onExcluir={(e) => handleDeleteTask(e, task)}
                        />
                      ))}
                      {extras > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDataRef(date);
                            setVisao("dia");
                          }}
                          className="px-1 text-[10px] text-ink-muted hover:text-ink"
                        >
                          +{extras} mais
                        </button>
                      )}
                    </div>

                    {tarefasDoDia.length === 0 && (
                      <span className="pointer-events-none absolute bottom-1.5 left-1.5 text-[10px] font-medium text-brand-forte opacity-0 transition-opacity group-hover:opacity-100">
                        + Adicionar
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <GradeHoras
            dias={visao === "semana" ? diasDaSemana(dataRef) : [dataRef]}
            tasksPorDia={tasksPorDia}
            hojeKey={hojeKey}
            detalhado={visao === "dia"}
            projetos={projects}
            onCriar={abrirCriar}
            onAbrir={abrirEditar}
            onExcluir={handleDeleteTask}
            onVerDia={(d) => {
              setDataRef(d);
              setVisao("dia");
            }}
          />
        )}

        {!temEventos && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            {busca
              ? "Nenhum evento encontrado com esse termo."
              : `Seu calendário está livre neste ${rotuloPeriodo}.`}
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
          initialDueTime={horaSelecionada}
          onClose={fecharModal}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function ChipTarefa({
  task,
  dia,
  onAbrir,
  onExcluir,
}: {
  task: Task;
  dia?: string;
  onAbrir: () => void;
  onExcluir: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className="group/chip flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface-hover"
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${corTarefa(task.color).dot}`} />
      <span
        className={`flex-1 truncate text-[11px] ${
          task.status === "done" ? "text-ink-muted line-through" : "text-ink"
        }`}
      >
        {task.title}
      </span>
      {dia && dia !== task.due_date ? (
        <span className="hidden flex-shrink-0 text-[10px] text-ink-muted sm:inline">
          até {task.due_date?.split("-").reverse().slice(0, 2).join("/")}
        </span>
      ) : (
        task.due_time && (
          <span className="hidden flex-shrink-0 text-[10px] text-ink-muted sm:inline">
            {task.due_time.slice(0, 5)}
          </span>
        )
      )}
      <button
        onClick={onExcluir}
        title="Excluir tarefa"
        className="hidden flex-shrink-0 text-ink-muted hover:text-danger group-hover/chip:inline-flex"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

// Visões Semana (7 colunas) e Dia (1 coluna): faixa "Dia todo" com as
// tarefas sem horário e uma linha por hora. Clicar num horário vazio cria a
// tarefa já com dia e hora.
function GradeHoras({
  dias,
  tasksPorDia,
  hojeKey,
  detalhado,
  projetos,
  onCriar,
  onAbrir,
  onExcluir,
  onVerDia,
}: {
  dias: Date[];
  tasksPorDia: Record<string, Task[]>;
  hojeKey: string;
  detalhado: boolean;
  projetos: Project[];
  onCriar: (dia: string, hora?: number | null) => void;
  onAbrir: (t: Task) => void;
  onExcluir: (e: React.MouseEvent, t: Task) => void;
  onVerDia: (d: Date) => void;
}) {
  const rolagem = useRef<HTMLDivElement | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollTop = HORA_INICIAL_VISIVEL * ALTURA_HORA - 12;
  }, []);

  // Linha do "agora" anda sozinha.
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nomeProjeto = useMemo(
    () => new Map(projetos.map((p) => [p.id, p.name])),
    [projetos]
  );
  const colunas = `56px repeat(${dias.length}, minmax(${detalhado ? 0 : 96}px, 1fr))`;
  const topoAgora = (agora.getHours() + agora.getMinutes() / 60) * ALTURA_HORA;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div
        ref={rolagem}
        className={`max-h-[640px] overflow-y-auto rounded-xl border border-line scrollbar-thin ${
          detalhado ? "" : "min-w-[760px]"
        }`}
      >
        {/* Cabeçalho dos dias + "Dia todo" ficam presos no topo ao rolar, e
            dentro da mesma área de rolagem, pra alinhar com as colunas. */}
        <div className="sticky top-0 z-20 bg-surface">
        <div className="grid border-b border-line bg-canvas" style={{ gridTemplateColumns: colunas }}>
          <div />
          {dias.map((d) => {
            const key = dateKey(d);
            const ehHoje = key === hojeKey;
            return (
              <button
                key={key}
                onClick={() => onVerDia(d)}
                disabled={detalhado}
                className="flex flex-col items-center gap-0.5 border-l border-line py-2 disabled:cursor-default"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {DIAS_SEMANA[d.getDay()]}
                </span>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    ehHoje ? "bg-brand font-semibold text-navy" : "font-medium text-ink"
                  }`}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dia todo: tarefas sem horário */}
        <div className="grid border-b border-line" style={{ gridTemplateColumns: colunas }}>
          <div className="flex items-start justify-end px-2 py-1.5 text-[10px] font-medium text-ink-muted">
            Dia todo
          </div>
          {dias.map((d) => {
            const key = dateKey(d);
            const semHora = (tasksPorDia[key] ?? []).filter((t) => horaDaTarefa(t, key) === null);
            return (
              <div
                key={key}
                onClick={() => onCriar(key)}
                className="min-h-[36px] cursor-pointer space-y-0.5 border-l border-line p-1 hover:bg-canvas/70"
              >
                {semHora.map((t) =>
                  detalhado ? (
                    <CartaoTarefa dia={key} key={t.id} task={t} projeto={t.project_id ? nomeProjeto.get(t.project_id) : null} onAbrir={() => onAbrir(t)} onExcluir={(e) => onExcluir(e, t)} />
                  ) : (
                    <ChipTarefa dia={key} key={t.id} task={t} onAbrir={() => onAbrir(t)} onExcluir={(e) => onExcluir(e, t)} />
                  )
                )}
              </div>
            );
          })}
        </div>

        </div>

        {/* Horas */}
        <div>
          <div className="relative grid" style={{ gridTemplateColumns: colunas }}>
            {HORAS.map((h) => (
              <div key={`rotulo-${h}`} className="contents">
                <div
                  className="relative border-b border-line pr-2 text-right text-[10px] text-ink-muted"
                  style={{ height: ALTURA_HORA, gridColumn: 1 }}
                >
                  <span className="relative -top-1.5">{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>
                </div>
                {dias.map((d) => {
                  const key = dateKey(d);
                  const naHora = (tasksPorDia[key] ?? []).filter((t) => horaDaTarefa(t, key) === h);
                  return (
                    <div
                      key={`${key}-${h}`}
                      onClick={() => onCriar(key, h)}
                      title={`Criar tarefa às ${String(h).padStart(2, "0")}:00`}
                      className={`cursor-pointer space-y-0.5 overflow-hidden border-b border-l border-line p-0.5 hover:bg-canvas/70 ${
                        key === hojeKey && !detalhado ? "bg-brand-light/30" : ""
                      }`}
                      style={{ height: ALTURA_HORA }}
                    >
                      {naHora.map((t) =>
                        detalhado ? (
                          <CartaoTarefa dia={key} key={t.id} task={t} projeto={t.project_id ? nomeProjeto.get(t.project_id) : null} onAbrir={() => onAbrir(t)} onExcluir={(e) => onExcluir(e, t)} />
                        ) : (
                          <ChipTarefa dia={key} key={t.id} task={t} onAbrir={() => onAbrir(t)} onExcluir={(e) => onExcluir(e, t)} />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Linha do horário atual, só na coluna de hoje */}
            {dias.map((d, i) =>
              dateKey(d) === hojeKey ? (
                <div
                  key="agora"
                  className="pointer-events-none absolute z-10 h-0.5 bg-danger"
                  style={{
                    top: topoAgora,
                    left: `calc(56px + (100% - 56px) * ${i / dias.length})`,
                    width: `calc((100% - 56px) / ${dias.length})`,
                  }}
                  aria-hidden="true"
                >
                  <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-danger" />
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Na visão Dia sobra espaço: cartão com horário, título e cliente.
function CartaoTarefa({
  task,
  dia,
  projeto,
  onAbrir,
  onExcluir,
}: {
  task: Task;
  dia?: string;
  projeto: string | null | undefined;
  onAbrir: () => void;
  onExcluir: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className="group/chip flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1 hover:border-brand"
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${corTarefa(task.color).dot}`} />
      {dia && dia !== task.due_date ? (
        <span className="flex-shrink-0 text-xs text-ink-muted">até {task.due_date?.split("-").reverse().slice(0, 2).join("/")}</span>
      ) : (
        task.due_time && <span className="flex-shrink-0 text-xs font-medium text-ink-muted">{task.due_time.slice(0, 5)}</span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          task.status === "done" ? "text-ink-muted line-through" : "text-ink"
        }`}
      >
        {task.title}
      </span>
      <span className="hidden flex-shrink-0 truncate text-xs text-ink-muted sm:inline">
        {projeto ?? "Geral"}
      </span>
      <button
        onClick={onExcluir}
        title="Excluir tarefa"
        className="hidden flex-shrink-0 text-ink-muted hover:text-danger group-hover/chip:inline-flex"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
