"use client";

import { useState } from "react";
import Link from "next/link";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import { hhmm, rotuloDeHorario, umDiaSo } from "@/lib/horarios";
import type { ResumoTarefa } from "@/lib/task-resumo";
import type { Etiqueta } from "@/lib/etiquetas";
import { Avatar } from "./ui/Avatar";
import { EmptyState } from "./ui/EmptyState";
import { EtiquetaSelo } from "./EtiquetasDaTarefa";
import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  MessageCircleIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  SparklesIcon,
  Trash2Icon,
} from "./ui/icons";

type Coluna = { key: TaskStatus; label: string; dot: string };
type Ordem = "manual" | "titulo" | "cliente" | "prazo";

// Concluídas e canceladas começam recolhidas: a lista é pro que ainda está
// em andamento.
const RECOLHIDOS_NO_INICIO: TaskStatus[] = ["done", "cancelled"];

const GRADE_COM_CLIENTE = "md:grid-cols-[auto_minmax(0,1fr)_150px_150px_130px_170px_28px]";
const GRADE_SEM_CLIENTE = "md:grid-cols-[auto_minmax(0,1fr)_150px_130px_170px_28px]";

// Faixa colorida na lateral do título de cada grupo.
const BORDA_DO_GRUPO: Record<TaskStatus, string> = {
  todo: "border-l-brand-forte",
  doing: "border-l-warning",
  dependency: "border-l-orange-500",
  approval: "border-l-cal",
  done: "border-l-success",
  cancelled: "border-l-slate-400",
};

function dataCurta(iso: string) {
  return iso.split("-").reverse().slice(0, 2).join("/");
}

function dataCompleta(iso: string) {
  return iso.split("-").reverse().join("/");
}

// A lista de tarefas: as mesmas tarefas do quadro, em linhas agrupadas por
// status. Dá pra concluir, trocar o status, abrir e excluir sem sair daqui; as
// subtarefas ficam recolhíveis embaixo da principal.
export default function TarefasEmLista({
  colunas,
  tarefas,
  corDoCliente,
  filhas,
  hoje,
  mostrarCliente,
  nomesDosProjetos,
  pacotes,
  perfis,
  ligacoes,
  etiquetas,
  resumos,
  filtrando,
  aoAbrir,
  aoMudarStatus,
  aoAlternarSubtarefa,
  aoExcluir,
}: {
  colunas: Coluna[];
  tarefas: Task[];
  // Cor (hex) da lateral de cada linha: a do cliente da tarefa.
  corDoCliente: (t: Task) => string;
  filhas: Record<string, Task[]>;
  hoje: string;
  mostrarCliente: boolean;
  nomesDosProjetos: Map<string, string>;
  pacotes: Map<string, string>;
  perfis: Map<string, Profile>;
  ligacoes: Record<string, string[]>;
  etiquetas: Map<string, Etiqueta>;
  resumos: Record<string, ResumoTarefa>;
  filtrando: boolean;
  aoAbrir: (t: Task) => void;
  aoMudarStatus: (t: Task, status: TaskStatus) => void;
  aoAlternarSubtarefa: (t: Task) => void;
  aoExcluir: (t: Task) => void;
}) {
  const [ordem, setOrdem] = useState<Ordem>("manual");
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set(RECOLHIDOS_NO_INICIO));
  const [subsFechadas, setSubsFechadas] = useState<Set<string>>(new Set());
  // Tarefa com o menu "⋮" aberto.
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const grade = mostrarCliente ? GRADE_COM_CLIENTE : GRADE_SEM_CLIENTE;

  // No prazo, só dia/mês quando é do ano corrente.
  function md(iso: string) {
    return iso.slice(0, 4) === hoje.slice(0, 4) ? dataCurta(iso) : dataCompleta(iso);
  }

  const nomeDe = (id: string) => perfis.get(id)?.name || perfis.get(id)?.username || "?";
  const cliente = (t: Task) => (t.project_id ? nomesDosProjetos.get(t.project_id) ?? "Cliente" : "");

  function ordenar(lista: Task[]) {
    const copia = [...lista];
    if (ordem === "titulo") copia.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    else if (ordem === "cliente")
      copia.sort((a, b) => cliente(a).localeCompare(cliente(b), "pt-BR") || a.position - b.position);
    else if (ordem === "prazo")
      // Sem prazo por último.
      copia.sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") || a.position - b.position);
    else copia.sort((a, b) => a.position - b.position);
    return copia;
  }

  function alternar(conjunto: Set<string>, id: string) {
    const novo = new Set(conjunto);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    return novo;
  }

  const cabecalho = (de: Ordem, rotulo: string) => (
    <button
      type="button"
      onClick={() => setOrdem((atual) => (atual === de ? "manual" : de))}
      aria-pressed={ordem === de}
      title={ordem === de ? "Voltar à ordem do quadro" : `Ordenar por ${rotulo.toLowerCase()}`}
      className={`flex items-center gap-1 text-left hover:text-ink ${ordem === de ? "text-ink" : ""}`}
    >
      {rotulo}
      {ordem === de && <ChevronDownIcon className="h-3 w-3" />}
    </button>
  );

  if (tarefas.length === 0) {
    return (
      <EmptyState
        icon={<SparklesIcon className="h-4 w-4" />}
        title={filtrando ? "Nada por aqui" : "Tudo limpo por aqui"}
        description={filtrando ? "Nenhuma tarefa bate com o filtro atual." : undefined}
      />
    );
  }

  return (
    <div data-mov="card" className="rounded-2xl border border-line bg-surface">
      <div
        className={`hidden items-center gap-x-3 rounded-t-2xl border-b border-line bg-canvas px-4 py-2.5 text-xs font-medium text-ink-muted md:grid ${grade}`}
      >
        <span className="w-4" aria-hidden="true" />
        {cabecalho("titulo", "Tarefa")}
        {mostrarCliente && cabecalho("cliente", "Cliente")}
        <span>Resp.</span>
        {cabecalho("prazo", "Prazo")}
        <span>Status</span>
        <span />
      </div>

      {colunas.map((coluna) => {
        const daColuna = ordenar(tarefas.filter((t) => t.status === coluna.key));
        if (daColuna.length === 0) return null;
        const fechado = recolhidos.has(coluna.key);
        return (
          <section key={coluna.key} aria-label={coluna.label}>
            <button
              type="button"
              onClick={() => setRecolhidos((atual) => alternar(atual, coluna.key))}
              aria-expanded={!fechado}
              className={`flex w-full items-center gap-2 border-b border-l-[3px] border-line bg-canvas/60 px-4 py-2.5 text-left hover:bg-surface-hover ${BORDA_DO_GRUPO[coluna.key]}`}
            >
              <ChevronDownIcon className={`h-3.5 w-3.5 text-ink-muted transition-transform ${fechado ? "-rotate-90" : ""}`} />
              <span className={`h-2 w-2 rounded-full ${coluna.dot}`} />
              <h2 className="text-sm font-semibold text-ink">{coluna.label}</h2>
              <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                {daColuna.length}
              </span>
            </button>

            {!fechado && (
              <ul>
                {daColuna.map((task) => {
                  const subs = (filhas[task.id] ?? []).filter((s) => s.status !== "cancelled");
                  const subsFeitas = subs.filter((s) => s.status === "done").length;
                  const aberta = !subsFechadas.has(task.id);
                  const feita = task.status === "done";
                  // Concluída: cinza e apagada (menos o menu ⋮, que fica normal).
                  const cancelada = task.status === "cancelled";
                  // Cancelada: apagada, com o título riscado de vermelho (sem cinza,
                  // pra o risco continuar vermelho).
                  const apagada = feita ? "opacity-60 grayscale" : cancelada ? "opacity-60" : "";
                  const atrasada = !!task.due_date && task.due_date < hoje && task.status !== "done" && task.status !== "cancelled";
                  const marcas = (ligacoes[task.id] ?? []).flatMap((id) => {
                    const et = etiquetas.get(id);
                    return et ? [et] : [];
                  });
                  const resumo = resumos[task.id];
                  return (
                    <li key={task.id} className="border-b border-line last:border-b-0">
                      <div
                        onClick={() => aoAbrir(task)}
                        style={{ borderLeftColor: feita || cancelada ? "#9AA0A6" : corDoCliente(task) }}
                        className={`group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-l-[3px] px-4 py-2.5 hover:bg-surface-hover ${grade}`}
                      >
                        <input
                          type="checkbox"
                          checked={feita}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => aoMudarStatus(task, feita ? "todo" : "done")}
                          aria-label={feita ? "Reabrir tarefa" : "Concluir tarefa"}
                          className="h-4 w-4"
                        />
                        <div className={`min-w-0 ${apagada}`}>
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`truncate text-sm font-medium ${
                                feita ? "text-ink-muted line-through" : cancelada ? "text-ink-muted line-through decoration-red-500 decoration-2" : "text-ink"
                              }`}
                            >
                              {task.title}
                            </p>
                            {subs.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubsFechadas((atual) => alternar(atual, task.id));
                                }}
                                aria-expanded={aberta}
                                title={aberta ? "Esconder as subtarefas" : "Mostrar as subtarefas"}
                                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-ink"
                              >
                                🧩 {subsFeitas}/{subs.length}
                                <ChevronDownIcon className={`h-3 w-3 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                              </button>
                            )}
                          </div>
                          {(marcas.length > 0 || resumo || task.parent_id) && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                              {task.parent_id && <span className="font-medium text-brand-forte">↳ Subtarefa</span>}
                              {resumo && (
                                <>
                                  <span className="inline-flex items-center gap-1" title="Checklist">
                                    <CheckSquareIcon className="h-3.5 w-3.5" />
                                    {resumo.checklistFeitos}/{resumo.checklistTotal}
                                  </span>
                                  <span className="inline-flex items-center gap-1" title="Comentários">
                                    <MessageCircleIcon className="h-3.5 w-3.5" />
                                    {resumo.comentarios}
                                  </span>
                                  <span className="inline-flex items-center gap-1" title="Anexos">
                                    <PaperclipIcon className="h-3.5 w-3.5" />
                                    {resumo.anexos}
                                  </span>
                                </>
                              )}
                              {marcas.map((et) => (
                                <EtiquetaSelo key={et.id} etiqueta={et} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* No celular os campos ficam embaixo do título; no computador viram colunas. */}
                        <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:contents">
                          {mostrarCliente && (
                            <div className={`min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted ${apagada}`}>
                              {task.project_id ? (
                                <Link
                                  href={`/projetos/${task.project_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-ink hover:underline"
                                  title={pacotes.get(task.project_id) ? `${cliente(task)} · ${pacotes.get(task.project_id)}` : cliente(task)}
                                >
                                  {cliente(task)}
                                </Link>
                              ) : null}
                            </div>
                          )}
                          <div className={`flex min-w-0 items-center gap-2 ${apagada}`}>
                            {task.assigned_to.length > 0 ? (
                              <>
                                <Avatar
                                  name={nomeDe(task.assigned_to[0])}
                                  src={perfis.get(task.assigned_to[0])?.avatar_url}
                                  size="sm"
                                  className="flex-shrink-0"
                                />
                                <span
                                  className="min-w-0 truncate text-xs text-ink"
                                  title={task.assigned_to.map(nomeDe).join(", ")}
                                >
                                  {nomeDe(task.assigned_to[0])}
                                  {task.assigned_to.length > 1 && (
                                    <span className="ml-1 text-ink-muted">+{task.assigned_to.length - 1}</span>
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-ink-muted">—</span>
                            )}
                          </div>
                          <span
                            className={`flex items-center gap-1 whitespace-nowrap text-xs ${
                              atrasada ? "font-medium text-danger" : "text-ink-muted"
                            } ${apagada}`}
                          >
                            {task.due_date ? (
                              <>
                                <CalendarIcon className="h-3 w-3" />
                                {!umDiaSo(task) ? `${dataCurta(task.start_date!)}${task.start_time ? ` ${hhmm(task.start_time)}` : ""} → ` : ""}
                                {md(task.due_date)}
                                {(() => {
                                  const hora = umDiaSo(task) ? rotuloDeHorario(task) : hhmm(task.due_time);
                                  return hora ? ` ${hora}` : "";
                                })()}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                          {/* Status em pílula: o seletor de verdade fica por cima, transparente. */}
                          <span className={`relative inline-flex w-[170px] max-w-full ${apagada}`}>
                            <span className="pointer-events-none absolute inset-0 flex items-center gap-2 rounded-full border border-line bg-surface-hover pl-3 pr-7 text-xs font-medium text-ink">
                              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${coluna.dot}`} />
                              <span className="truncate">{coluna.label}</span>
                              <ChevronDownIcon className="absolute right-2.5 h-3 w-3 text-ink-muted" />
                            </span>
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => aoMudarStatus(task, e.target.value as TaskStatus)}
                              aria-label="Status da tarefa"
                              className="h-8 w-full cursor-pointer appearance-none rounded-full bg-transparent text-transparent focus:outline-none focus:ring-2 focus:ring-brand/30"
                            >
                              {colunas.map((c) => (
                                <option key={c.key} value={c.key} className="bg-surface text-ink">
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </span>
                          <div className="relative ml-auto md:ml-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setMenuAberto((atual) => (atual === task.id ? null : task.id))}
                              aria-haspopup="menu"
                              aria-expanded={menuAberto === task.id}
                              aria-label="Mais opções da tarefa"
                              className="grid h-7 w-7 place-items-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink"
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </button>
                            {menuAberto === task.id && (
                              <>
                                <button
                                  type="button"
                                  aria-label="Fechar o menu"
                                  tabIndex={-1}
                                  onClick={() => setMenuAberto(null)}
                                  className="fixed inset-0 z-10 cursor-default"
                                />
                                <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuAberto(null);
                                      aoAbrir(task);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-hover"
                                  >
                                    Abrir
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuAberto(null);
                                      aoExcluir(task);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-danger hover:bg-surface-hover"
                                  >
                                    <Trash2Icon className="h-3.5 w-3.5" />
                                    Excluir
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {subs.length > 0 && aberta && (
                        <ul className="border-t border-line bg-canvas/50">
                          {subs.map((s) => {
                            const sFeita = s.status === "done";
                            const sAtrasada = !!s.due_date && s.due_date < hoje && !sFeita;
                            return (
                              <li
                                key={s.id}
                                onClick={() => aoAbrir(s)}
                                className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-12 pr-4 hover:bg-surface-hover ${
                                  sFeita ? "opacity-60 grayscale" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={sFeita}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => aoAlternarSubtarefa(s)}
                                  aria-label={sFeita ? "Reabrir subtarefa" : "Concluir subtarefa"}
                                  className="h-3.5 w-3.5"
                                />
                                <span className={`min-w-0 flex-1 truncate text-xs ${sFeita ? "text-ink-muted line-through" : "text-ink"}`}>
                                  {s.title}
                                </span>
                                {s.status !== "todo" && s.status !== "done" && (
                                  <span className="text-[11px] text-ink-muted">
                                    {colunas.find((c) => c.key === s.status)?.label ?? ""}
                                  </span>
                                )}
                                {s.due_date && (
                                  <span className={`text-[11px] ${sAtrasada ? "font-medium text-danger" : "text-ink-muted"}`}>
                                    {dataCurta(s.due_date)}
                                  </span>
                                )}
                                {s.assigned_to.length > 0 && (
                                  <span className="flex -space-x-1">
                                    {s.assigned_to.slice(0, 3).map((id) => (
                                      <Avatar key={id} name={nomeDe(id)} src={perfis.get(id)?.avatar_url} size="xs" className="ring-1 ring-surface" />
                                    ))}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
