"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataBR } from "@/lib/format";
import {
  andamento,
  carregarSubprojetos,
  ERRO_SEM_MIGRATION,
  STATUS_DO_SUBPROJETO,
  type StatusDoSubprojeto,
  type Subprojeto,
} from "@/lib/subprojetos";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import TaskModal from "../TaskModal";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ChevronLeftIcon, FolderIcon, LinkIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "../ui/icons";

const ROTULO_DO_STATUS: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  dependency: "Em dependência",
  approval: "Em aprovação",
  done: "Concluída",
  cancelled: "Cancelada",
};

const PONTO_DO_STATUS: Record<TaskStatus, string> = {
  todo: "bg-brand-forte",
  doing: "bg-warning",
  dependency: "bg-orange-500",
  approval: "bg-cal",
  done: "bg-success",
  cancelled: "bg-slate-400",
};

const ORDEM_DO_STATUS: TaskStatus[] = ["doing", "approval", "dependency", "todo", "done", "cancelled"];

const campo =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function hojeISO() {
  return new Date().toLocaleDateString("en-CA");
}

function emAberto(t: Pick<Task, "status">) {
  return t.status !== "done" && t.status !== "cancelled";
}

function periodo(sp: Pick<Subprojeto, "start_date" | "due_date">) {
  if (sp.start_date && sp.due_date) return `${formatarDataBR(sp.start_date)} → ${formatarDataBR(sp.due_date)}`;
  if (sp.due_date) return `Entrega ${formatarDataBR(sp.due_date)}`;
  if (sp.start_date) return `Desde ${formatarDataBR(sp.start_date)}`;
  return "";
}

function ordenarTarefas(lista: Task[]) {
  return [...lista].sort((a, b) => {
    const s = ORDEM_DO_STATUS.indexOf(a.status) - ORDEM_DO_STATUS.indexOf(b.status);
    if (s !== 0) return s;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });
}

type Rascunho = Pick<Subprojeto, "name" | "description" | "status" | "start_date" | "due_date"> & { id?: string };

// Aba "Projetos" do cliente (migration 0083): frentes de trabalho que agrupam
// tarefas do cliente, com o andamento de cada uma. A tarefa entra no projeto
// por aqui ("Nova tarefa" ou "Ligar tarefas") ou pelo campo "Projeto" dela.
export default function ProjetosDoCliente({
  projectId,
  profiles,
  currentUserId,
  currentUserLabel,
  souLider,
}: {
  projectId: string;
  profiles: Profile[];
  currentUserId: string;
  currentUserLabel: string;
  souLider: boolean;
}) {
  const supabase = createClient();
  const [projetos, setProjetos] = useState<Subprojeto[]>([]);
  const [tarefas, setTarefas] = useState<Task[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [verConcluidos, setVerConcluidos] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [form, setForm] = useState<Rascunho | null>(null);
  const [ligando, setLigando] = useState(false);
  const [modal, setModal] = useState<{ tarefa: Task | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ lista, erro }, { data: ts }] = await Promise.all([
        carregarSubprojetos(supabase, projectId),
        supabase.from("tasks").select("*").eq("project_id", projectId).order("position", { ascending: true }),
      ]);
      if (!ativo) return;
      setErroCarregar(erro ? ERRO_SEM_MIGRATION : null);
      setProjetos(lista);
      setTarefas((ts ?? []) as Task[]);
      setCarregando(false);
    })();
    const canal = supabase
      .channel(`subprojetos-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subprojects" }, (payload) => {
        setProjetos((atual) => {
          if (payload.eventType === "DELETE") return atual.filter((p) => p.id !== (payload.old as Subprojeto).id);
          const novo = payload.new as Subprojeto;
          if (novo.project_id !== projectId) return atual;
          return atual.some((p) => p.id === novo.id) ? atual.map((p) => (p.id === novo.id ? novo : p)) : [...atual, novo];
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        setTarefas((atual) => {
          if (payload.eventType === "DELETE") return atual.filter((t) => t.id !== (payload.old as Task).id);
          const nova = payload.new as Task;
          if (nova.project_id !== projectId) return atual.filter((t) => t.id !== nova.id);
          return atual.some((t) => t.id === nova.id) ? atual.map((t) => (t.id === nova.id ? nova : t)) : [...atual, nova];
        });
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const tarefasPorProjeto = useMemo(() => {
    const mapa = new Map<string, Task[]>();
    tarefas.forEach((t) => {
      if (t.subproject_id) mapa.set(t.subproject_id, [...(mapa.get(t.subproject_id) ?? []), t]);
    });
    return mapa;
  }, [tarefas]);

  const perfilPorId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const nomeDe = (id: string) => perfilPorId.get(id)?.name || perfilPorId.get(id)?.username || "?";

  const emAndamento = projetos.filter((p) => p.status !== "concluido");
  const concluidos = projetos.filter((p) => p.status === "concluido");
  const visiveis = verConcluidos ? concluidos : emAndamento;
  const aberto = projetos.find((p) => p.id === abertoId) ?? null;

  function getNextPosition(status: TaskStatus) {
    return tarefas.filter((t) => t.status === status).reduce((max, t) => Math.max(max, t.position), 0) + 1;
  }

  function trocarTarefa(t: Task) {
    setTarefas((atual) => (atual.some((x) => x.id === t.id) ? atual.map((x) => (x.id === t.id ? t : x)) : [...atual, t]));
  }

  async function ligar(ids: string[], subprojetoId: string | null) {
    if (ids.length === 0) return true;
    const antes = tarefas;
    setTarefas((atual) => atual.map((t) => (ids.includes(t.id) ? { ...t, subproject_id: subprojetoId } : t)));
    const { error } = await supabase.from("tasks").update({ subproject_id: subprojetoId }).in("id", ids);
    if (error) {
      setTarefas(antes);
      setAviso("Não deu pra mudar o projeto das tarefas. Tenta de novo.");
      return false;
    }
    return true;
  }

  async function excluir(sp: Subprojeto) {
    if (!window.confirm(`Excluir o projeto "${sp.name}"? As tarefas continuam no quadro, só saem do projeto.`)) return;
    const { error } = await supabase.from("subprojects").delete().eq("id", sp.id);
    if (error) return setAviso("Não deu pra excluir o projeto. Tenta de novo.");
    setProjetos((atual) => atual.filter((p) => p.id !== sp.id));
    setTarefas((atual) => atual.map((t) => (t.subproject_id === sp.id ? { ...t, subproject_id: null } : t)));
    setAbertoId(null);
  }

  async function mudarStatus(sp: Subprojeto, status: StatusDoSubprojeto) {
    setProjetos((atual) => atual.map((p) => (p.id === sp.id ? { ...p, status } : p)));
    const { error } = await supabase.from("subprojects").update({ status }).eq("id", sp.id);
    if (error) {
      setProjetos((atual) => atual.map((p) => (p.id === sp.id ? sp : p)));
      setAviso("Não deu pra mudar o status. Tenta de novo.");
    }
  }

  if (carregando) return <p className="py-8 text-center text-sm text-ink-muted">Carregando projetos...</p>;

  const modalDeTarefa = modal && (
    <TaskModal
      key={modal.tarefa?.id ?? "nova"}
      task={modal.tarefa}
      projectId={projectId}
      projects={[]}
      profiles={profiles}
      currentUserLabel={currentUserLabel}
      getNextPosition={getNextPosition}
      initialSubprojectId={aberto?.id ?? null}
      onAbrirOutra={(t) => setModal({ tarefa: t })}
      onClose={() => setModal(null)}
      onCreated={trocarTarefa}
      onUpdated={trocarTarefa}
      onDeleted={(id) => setTarefas((atual) => atual.filter((t) => t.id !== id))}
    />
  );

  if (aberto) {
    const doProjeto = ordenarTarefas(tarefasPorProjeto.get(aberto.id) ?? []);
    const a = andamento(doProjeto);
    const podeExcluir = souLider || aberto.created_by === currentUserId;
    const hoje = hojeISO();
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setAbertoId(null)}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Todos os projetos
        </button>

        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold text-ink">{aberto.name}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {[periodo(aberto), aberto.created_by_label && `criado por ${aberto.created_by_label}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={aberto.status}
                onChange={(e) => mudarStatus(aberto, e.target.value as StatusDoSubprojeto)}
                aria-label="Status do projeto"
                className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none"
              >
                {(Object.keys(STATUS_DO_SUBPROJETO) as StatusDoSubprojeto[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DO_SUBPROJETO[s].label}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => setForm({ ...aberto })}>
                <PencilIcon className="h-3.5 w-3.5" />
                Editar
              </Button>
              {podeExcluir && (
                <Button size="sm" variant="danger" onClick={() => excluir(aberto)} aria-label="Excluir projeto">
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {aberto.description && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{aberto.description}</p>
          )}
          <BarraDeAndamento {...a} className="mt-4" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setModal({ tarefa: null })}>
            <PlusIcon className="h-3.5 w-3.5" />
            Nova tarefa
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setLigando(true)}>
            <LinkIcon className="h-3.5 w-3.5" />
            Ligar tarefas do cliente
          </Button>
        </div>
        {aviso && <p className="text-xs text-danger">{aviso}</p>}

        {doProjeto.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<FolderIcon className="h-6 w-6" />}
              title="Nenhuma tarefa neste projeto"
              description="Crie uma tarefa aqui ou ligue tarefas que já existem no quadro do cliente."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {doProjeto.map((t) => {
              const atrasada = emAberto(t) && !!t.due_date && t.due_date < hoje;
              return (
                <li key={t.id} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setModal({ tarefa: t })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${PONTO_DO_STATUS[t.status]}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          t.status === "done" || t.status === "cancelled" ? "text-ink-muted line-through" : "text-ink"
                        }`}
                      >
                        {t.parent_id ? "↳ " : ""}
                        {t.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        {ROTULO_DO_STATUS[t.status]}
                        {t.due_date && (
                          <span className={atrasada ? "font-medium text-danger" : ""}>
                            {" · "}
                            {atrasada ? "Atrasada · " : ""}
                            {formatarDataBR(t.due_date)}
                          </span>
                        )}
                      </span>
                    </span>
                    {t.assigned_to.length > 0 && (
                      <span className="hidden flex-shrink-0 -space-x-1.5 sm:flex">
                        {t.assigned_to.slice(0, 3).map((id) => (
                          <Avatar key={id} name={nomeDe(id)} src={perfilPorId.get(id)?.avatar_url} size="xs" className="ring-2 ring-surface" />
                        ))}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => ligar([t.id], null)}
                    title="Tirar do projeto (a tarefa continua no quadro)"
                    aria-label={`Tirar "${t.title}" do projeto`}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {ligando && (
          <LigarTarefas
            projeto={aberto}
            projetos={projetos}
            tarefas={tarefas}
            aoFechar={() => setLigando(false)}
            aoLigar={async (ids) => {
              if (await ligar(ids, aberto.id)) setLigando(false);
            }}
          />
        )}
        {form && (
          <FormDoProjeto
            rascunho={form}
            projectId={projectId}
            currentUserLabel={currentUserLabel}
            aoFechar={() => setForm(null)}
            aoSalvar={(sp) => {
              setProjetos((atual) => (atual.some((p) => p.id === sp.id) ? atual.map((p) => (p.id === sp.id ? sp : p)) : [...atual, sp]));
              setForm(null);
            }}
          />
        )}
        {modalDeTarefa}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
          {[
            { v: false, label: `Em andamento (${emAndamento.length})` },
            { v: true, label: `Concluídos (${concluidos.length})` },
          ].map((op) => (
            <button
              key={String(op.v)}
              type="button"
              onClick={() => setVerConcluidos(op.v)}
              className={`rounded-md px-3 py-1.5 ${verConcluidos === op.v ? "bg-brand-light text-brand-forte" : "text-ink-muted hover:text-ink"}`}
            >
              {op.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setForm({ name: "", description: null, status: "ativo", start_date: null, due_date: null })} disabled={!!erroCarregar}>
          <PlusIcon className="h-3.5 w-3.5" />
          Novo projeto
        </Button>
      </div>

      {erroCarregar && <p className="text-xs text-danger">{erroCarregar}</p>}
      {aviso && <p className="text-xs text-danger">{aviso}</p>}

      {visiveis.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<FolderIcon className="h-6 w-6" />}
            title={verConcluidos ? "Nenhum projeto concluído" : "Nenhum projeto em andamento"}
            description="Agrupe as tarefas do cliente em projetos (um site, uma campanha, um lançamento) e acompanhe o andamento de cada um."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((sp) => (
            <CartaoDoProjeto
              key={sp.id}
              projeto={sp}
              tarefas={tarefasPorProjeto.get(sp.id) ?? []}
              nomeDe={nomeDe}
              fotoDe={(id) => perfilPorId.get(id)?.avatar_url}
              aoAbrir={() => {
                setAviso(null);
                setAbertoId(sp.id);
              }}
            />
          ))}
        </div>
      )}

      {form && (
        <FormDoProjeto
          rascunho={form}
          projectId={projectId}
          currentUserLabel={currentUserLabel}
          aoFechar={() => setForm(null)}
          aoSalvar={(sp) => {
            setProjetos((atual) => (atual.some((p) => p.id === sp.id) ? atual.map((p) => (p.id === sp.id ? sp : p)) : [...atual, sp]));
            setForm(null);
            setAbertoId(sp.id);
          }}
        />
      )}
    </div>
  );
}

function BarraDeAndamento({ feitas, total, pct, className = "" }: { feitas: number; total: number; pct: number; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted">
        <span>{total === 0 ? "Sem tarefas" : `${feitas} de ${total} ${total === 1 ? "tarefa concluída" : "tarefas concluídas"}`}</span>
        {total > 0 && <span className="font-medium text-ink">{pct}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CartaoDoProjeto({
  projeto,
  tarefas,
  nomeDe,
  fotoDe,
  aoAbrir,
}: {
  projeto: Subprojeto;
  tarefas: Task[];
  nomeDe: (id: string) => string;
  fotoDe: (id: string) => string | null | undefined;
  aoAbrir: () => void;
}) {
  const hoje = hojeISO();
  const a = andamento(tarefas);
  const atrasadas = tarefas.filter((t) => emAberto(t) && !!t.due_date && t.due_date < hoje).length;
  const pessoas = Array.from(new Set(tarefas.filter(emAberto).flatMap((t) => t.assigned_to)));
  const status = STATUS_DO_SUBPROJETO[projeto.status];
  const vencido = projeto.status !== "concluido" && !!projeto.due_date && projeto.due_date < hoje;
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40 hover:bg-surface-hover/40"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold text-ink">{projeto.name}</h3>
        <Badge tone={status.tom}>{status.label}</Badge>
      </div>
      {(projeto.start_date || projeto.due_date) && (
        <p className={`-mt-1.5 text-[11px] ${vencido ? "font-medium text-danger" : "text-ink-muted"}`}>
          {vencido ? "Prazo vencido · " : ""}
          {periodo(projeto)}
        </p>
      )}
      <BarraDeAndamento {...a} className="w-full" />
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`text-[11px] ${atrasadas ? "font-medium text-danger" : "text-ink-muted"}`}>
          {atrasadas ? `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}
        </span>
        {pessoas.length > 0 && (
          <span className="flex -space-x-1.5">
            {pessoas.slice(0, 4).map((id) => (
              <Avatar key={id} name={nomeDe(id)} src={fotoDe(id)} size="xs" className="ring-2 ring-surface" />
            ))}
            {pessoas.length > 4 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-[9px] font-semibold text-ink-muted ring-2 ring-surface">
                +{pessoas.length - 4}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  );
}

function Janela({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormDoProjeto({
  rascunho,
  projectId,
  currentUserLabel,
  aoFechar,
  aoSalvar,
}: {
  rascunho: Rascunho;
  projectId: string;
  currentUserLabel: string;
  aoFechar: () => void;
  aoSalvar: (sp: Subprojeto) => void;
}) {
  const supabase = createClient();
  const [nome, setNome] = useState(rascunho.name);
  const [descricao, setDescricao] = useState(rascunho.description ?? "");
  const [status, setStatus] = useState<StatusDoSubprojeto>(rascunho.status);
  const [inicio, setInicio] = useState(rascunho.start_date ?? "");
  const [entrega, setEntrega] = useState(rascunho.due_date ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Dê um nome ao projeto.");
    if (inicio && entrega && inicio > entrega) return setErro("O início não pode ser depois da entrega.");
    setSalvando(true);
    setErro(null);
    const campos = {
      name: nome.trim(),
      description: descricao.trim() || null,
      status,
      start_date: inicio || null,
      due_date: entrega || null,
    };
    const { data, error } = rascunho.id
      ? await supabase.from("subprojects").update(campos).eq("id", rascunho.id).select().single()
      : await supabase
          .from("subprojects")
          .insert({ ...campos, project_id: projectId, created_by_label: currentUserLabel || null })
          .select()
          .single();
    setSalvando(false);
    if (error || !data) return setErro(`Não deu pra salvar o projeto. ${error?.message ?? ""}`.trim());
    aoSalvar(data as Subprojeto);
  }

  return (
    <Janela titulo={rascunho.id ? "Editar projeto" : "Novo projeto"} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 overflow-y-auto p-4">
          <div>
            <label htmlFor="sp-nome" className="mb-1 block text-xs font-medium text-ink-muted">
              Nome
            </label>
            <input
              id="sp-nome"
              autoFocus
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Site novo, Campanha de Natal"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="sp-descricao" className="mb-1 block text-xs font-medium text-ink-muted">
              Descrição <span className="font-normal">(opcional)</span>
            </label>
            <textarea
              id="sp-descricao"
              value={descricao}
              maxLength={4000}
              rows={3}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O objetivo, o escopo, links importantes..."
              className={campo}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="sp-status" className="mb-1 block text-xs font-medium text-ink-muted">
                Status
              </label>
              <select id="sp-status" value={status} onChange={(e) => setStatus(e.target.value as StatusDoSubprojeto)} className={campo}>
                {(Object.keys(STATUS_DO_SUBPROJETO) as StatusDoSubprojeto[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DO_SUBPROJETO[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sp-inicio" className="mb-1 block text-xs font-medium text-ink-muted">
                Início
              </label>
              <input id="sp-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
            </div>
            <div>
              <label htmlFor="sp-entrega" className="mb-1 block text-xs font-medium text-ink-muted">
                Entrega
              </label>
              <input id="sp-entrega" type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={campo} />
            </div>
          </div>
          {erro && <p className="text-xs text-danger">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button type="button" variant="secondary" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : rascunho.id ? "Salvar" : "Criar projeto"}
          </Button>
        </div>
      </form>
    </Janela>
  );
}

function LigarTarefas({
  projeto,
  projetos,
  tarefas,
  aoFechar,
  aoLigar,
}: {
  projeto: Subprojeto;
  projetos: Subprojeto[];
  tarefas: Task[];
  aoFechar: () => void;
  aoLigar: (ids: string[]) => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [comFechadas, setComFechadas] = useState(false);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [ligando, setLigando] = useState(false);
  const nomeDoProjeto = new Map(projetos.map((p) => [p.id, p.name]));

  const termo = busca.trim().toLowerCase();
  const candidatas = ordenarTarefas(
    tarefas.filter(
      (t) =>
        t.subproject_id !== projeto.id &&
        (comFechadas || emAberto(t)) &&
        (!termo || t.title.toLowerCase().includes(termo))
    )
  );

  function alternar(id: string) {
    setEscolhidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <Janela titulo={`Ligar tarefas a "${projeto.name}"`} aoFechar={aoFechar}>
      <div className="space-y-2 border-b border-line p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tarefa do cliente..."
            aria-label="Buscar tarefa"
            className={`${campo} pl-9`}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={comFechadas} onChange={(e) => setComFechadas(e.target.checked)} />
          Mostrar concluídas e canceladas
        </label>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {candidatas.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-ink-muted">Nenhuma tarefa pra ligar.</li>
        )}
        {candidatas.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-hover/50">
              <input type="checkbox" checked={escolhidas.has(t.id)} onChange={() => alternar(t.id)} className="h-4 w-4 flex-shrink-0" />
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${PONTO_DO_STATUS[t.status]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {t.parent_id ? "↳ " : ""}
                  {t.title}
                </span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {ROTULO_DO_STATUS[t.status]}
                  {t.due_date ? ` · ${formatarDataBR(t.due_date)}` : ""}
                  {t.subproject_id && nomeDoProjeto.get(t.subproject_id)
                    ? ` · hoje em "${nomeDoProjeto.get(t.subproject_id)}"`
                    : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        <Button type="button" variant="secondary" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={escolhidas.size === 0 || ligando}
          onClick={async () => {
            setLigando(true);
            await aoLigar(Array.from(escolhidas));
            setLigando(false);
          }}
        >
          {ligando ? "Ligando..." : `Ligar ${escolhidas.size || ""} ${escolhidas.size === 1 ? "tarefa" : "tarefas"}`.replace("  ", " ")}
        </Button>
      </div>
    </Janela>
  );
}
