"use client";

import { useState } from "react";
import Link from "next/link";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import { corTarefa } from "@/lib/task-colors";
import { formatarHoras, temConteudo, type ResumoTarefa } from "@/lib/task-resumo";
import type { Etiqueta } from "@/lib/etiquetas";
import { Avatar } from "./ui/Avatar";
import { EmptyState } from "./ui/EmptyState";
import { EtiquetaSelo } from "./EtiquetasDaTarefa";
import { CalendarIcon, ChevronDownIcon, SparklesIcon, Trash2Icon } from "./ui/icons";

type Coluna = { key: TaskStatus; label: string; dot: string };
type Ordem = "manual" | "titulo" | "cliente" | "prazo";

// Concluídas e canceladas começam recolhidas: a lista é pro que ainda está
// em andamento.
const RECOLHIDOS_NO_INICIO: TaskStatus[] = ["done", "cancelled"];

const GRADE_COM_CLIENTE = "md:grid-cols-[auto_minmax(0,1fr)_150px_96px_110px_160px_24px]";
const GRADE_SEM_CLIENTE = "md:grid-cols-[auto_minmax(0,1fr)_96px_110px_160px_24px]";

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
    <div data-mov="card" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div
        className={`hidden items-center gap-x-3 border-b border-line bg-canvas px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted md:grid ${grade}`}
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
              className="flex w-full items-center gap-2 border-b border-line bg-canvas/60 px-4 py-2 text-left hover:bg-surface-hover"
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
                        className={`group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-l-[3px] px-4 py-2.5 hover:bg-surface-hover ${grade} ${corTarefa(task.color).borda}`}
                      >
                        <input
                          type="checkbox"
                          checked={feita}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => aoMudarStatus(task, feita ? "todo" : "done")}
                          aria-label={feita ? "Reabrir tarefa" : "Concluir tarefa"}
                          className="h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`truncate text-sm font-medium ${feita ? "text-ink-muted line-through" : "text-ink"}`}>
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
                          {(marcas.length > 0 || temConteudo(resumo) || task.parent_id) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                              {task.parent_id && <span className="font-medium text-brand-forte">↳ Subtarefa</span>}
                              {marcas.map((et) => (
                                <EtiquetaSelo key={et.id} etiqueta={et} />
                              ))}
                              {resumo && resumo.checklistTotal > 0 && (
                                <span title="Checklist">
                                  ✅ {resumo.checklistFeitos}/{resumo.checklistTotal}
                                </span>
                              )}
                              {resumo && resumo.comentarios > 0 && <span title="Comentários">💬 {resumo.comentarios}</span>}
                              {resumo && resumo.anexos > 0 && <span title="Anexos">📎 {resumo.anexos}</span>}
                              {resumo && resumo.horas > 0 && <span title="Horas registradas">⏱️ {formatarHoras(resumo.horas)}</span>}
                            </div>
                          )}
                        </div>

                        {/* No celular os campos ficam embaixo do título; no computador viram colunas. */}
                        <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:contents">
                          {mostrarCliente && (
                            <div className="min-w-0 truncate text-xs text-ink-muted">
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
                          <div className="flex -space-x-1.5">
                            {task.assigned_to.slice(0, 3).map((id) => (
                              <Avatar
                                key={id}
                                name={nomeDe(id)}
                                src={perfis.get(id)?.avatar_url}
                                size="xs"
                                className="ring-2 ring-surface"
                              />
                            ))}
                            {task.assigned_to.length > 3 && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-[9px] font-semibold text-ink-muted ring-2 ring-surface">
                                +{task.assigned_to.length - 3}
                              </span>
                            )}
                          </div>
                          <span
                            className={`flex items-center gap-1 whitespace-nowrap text-xs ${
                              atrasada ? "font-medium text-danger" : "text-ink-muted"
                            }`}
                          >
                            {task.due_date ? (
                              <>
                                <CalendarIcon className="h-3 w-3" />
                                {task.start_date && task.start_date !== task.due_date ? `${dataCurta(task.start_date)} → ` : ""}
                                {md(task.due_date)}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                          <select
                            value={task.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => aoMudarStatus(task, e.target.value as TaskStatus)}
                            aria-label="Status da tarefa"
                            className="h-8 w-full max-w-[160px] rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 md:max-w-none"
                          >
                            {colunas.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              aoExcluir(task);
                            }}
                            title="Excluir tarefa"
                            aria-label="Excluir tarefa"
                            className="ml-auto text-ink-muted opacity-60 transition-opacity hover:text-danger group-hover:opacity-100 md:ml-0 md:opacity-0"
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </button>
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
                                className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-12 pr-4 hover:bg-surface-hover"
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
