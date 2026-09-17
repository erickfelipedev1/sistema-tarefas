"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Task, TaskRequest } from "@/lib/types";
import { buildTaskSummaryBlocks } from "@/lib/task-wiki-sync";
import { formatarDataHora } from "@/lib/format";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { InboxIcon, LinkIcon, PlusIcon } from "./ui/icons";

type Aba = "recebidas" | "enviadas";
type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const DEMAND_TYPE_OPTIONS = [
  "Design",
  "Marketing",
  "Vídeo",
  "Social Media",
  "Tráfego pago",
  "Desenvolvimento",
  "Outro",
];

const CONTEXT_STATUS_OPTIONS = ["Novo", "Em andamento", "Recorrente", "Ajuste/Revisão"];

const URGENCY_OPTIONS = ["Baixa", "Média", "Alta", "Urgente"];

const URGENCY_TONE: Record<string, BadgeTone> = {
  Baixa: "neutral",
  Média: "brand",
  Alta: "warning",
  Urgente: "danger",
};

const DESCRICAO_MAX = 2000;

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function TaskRequests({
  currentUserId,
  currentUserLabel,
  initialRequests,
  profiles,
  projects,
}: {
  currentUserId: string;
  currentUserLabel: string;
  initialRequests: TaskRequest[];
  profiles: Profile[];
  projects: Project[];
}) {
  const supabase = createClient();
  const [requests, setRequests] = useState<TaskRequest[]>(initialRequests);
  const [aba, setAba] = useState<Aba>("recebidas");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [requestedTo, setRequestedTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contextStatus, setContextStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [description, setDescription] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [erroResponsavel, setErroResponsavel] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const profilesById = useMemo(() => {
    const mapa: Record<string, Profile> = {};
    profiles.forEach((p) => {
      mapa[p.id] = p;
    });
    return mapa;
  }, [profiles]);

  const projectsById = useMemo(() => {
    const mapa: Record<string, Project> = {};
    projects.forEach((p) => {
      mapa[p.id] = p;
    });
    return mapa;
  }, [projects]);

  function nomeDe(userId: string) {
    const p = profilesById[userId];
    return p?.name || p?.username || "Alguém";
  }

  useEffect(() => {
    const canal = supabase
      .channel("task-requests-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_requests" },
        (payload) => {
          setRequests((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as TaskRequest;
              if (
                novo.requested_to !== currentUserId &&
                novo.requested_by !== currentUserId
              )
                return current;
              if (current.some((r) => r.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as TaskRequest;
              return current.map((r) =>
                r.id === atualizado.id ? atualizado : r
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as TaskRequest).id;
              return current.filter((r) => r.id !== removidoId);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const recebidas = requests.filter((r) => r.requested_to === currentUserId);
  const enviadas = requests.filter((r) => r.requested_by === currentUserId);

  // Usado tanto pro aviso ao sair da página (fechar aba/atualizar) quanto
  // pro confirm ao clicar em "Cancelar" — evita perder o que já foi
  // preenchido sem querer.
  const formTemDados =
    title.trim() !== "" ||
    demandType !== "" ||
    requestedTo !== "" ||
    projectId !== "" ||
    contextStatus !== "" ||
    urgency !== "" ||
    dueDate !== "" ||
    driveUrl.trim() !== "" ||
    description.trim() !== "";

  useEffect(() => {
    function avisarAntesDeSair(e: BeforeUnloadEvent) {
      if (!mostrarForm || !formTemDados) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarAntesDeSair);
    return () => window.removeEventListener("beforeunload", avisarAntesDeSair);
  }, [mostrarForm, formTemDados]);

  function limparForm() {
    setTitle("");
    setDemandType("");
    setRequestedTo("");
    setProjectId("");
    setContextStatus("");
    setUrgency("");
    setDueDate("");
    setDriveUrl("");
    setDescription("");
    setErroTitulo(null);
    setErroResponsavel(null);
    setErroEnvio(null);
    setMostrarForm(false);
  }

  function fecharForm() {
    if (formTemDados) {
      const ok = window.confirm(
        "Você preencheu dados que ainda não foram enviados. Sair sem enviar mesmo assim?"
      );
      if (!ok) return;
    }
    limparForm();
  }

  // Ao enviar, a tarefa já é criada na hora — não fica esperando ninguém
  // aceitar ou recusar. O pedido fica registrado (pra aparecer em
  // "Enviadas"/"Recebidas"), já com status "accepted" e ligado à tarefa.
  async function criarSolicitacao() {
    const tituloValido = title.trim() !== "";
    const responsavelValido = requestedTo !== "";
    setErroTitulo(tituloValido ? null : "Dá um nome pra essa demanda.");
    setErroResponsavel(responsavelValido ? null : "Escolhe pra quem é a solicitação.");
    if (!tituloValido || !responsavelValido) return;

    setSalvando(true);
    setErroEnvio(null);

    const detalhes: string[] = [];
    if (demandType) detalhes.push(`Tipo de demanda: ${demandType}`);
    if (contextStatus) detalhes.push(`Status: ${contextStatus}`);
    if (urgency) detalhes.push(`Urgência: ${urgency}`);
    if (driveUrl.trim()) detalhes.push(`Drive: ${driveUrl.trim()}`);

    const descricaoTarefa = [
      description.trim(),
      detalhes.length ? `📋 Detalhes da solicitação:\n${detalhes.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: ultimaTarefa } = await supabase
      .from("tasks")
      .select("position")
      .eq("status", "todo")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const proximaPosicao = (ultimaTarefa?.position ?? 0) + 1;

    const { data: novaTarefa, error: erroTarefa } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: descricaoTarefa || null,
        status: "todo",
        position: proximaPosicao,
        project_id: projectId || null,
        due_date: dueDate || null,
        assigned_to: [requestedTo],
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (erroTarefa || !novaTarefa) {
      setSalvando(false);
      setErroEnvio("Não foi possível enviar a solicitação. Tente novamente.");
      return;
    }

    let tarefaFinal = novaTarefa as Task;

    // Cria a página da Wiki dessa tarefa na hora, igual acontece quando a
    // tarefa é criada pelo quadro normal.
    const { data: pagina } = await supabase
      .from("pages")
      .insert({
        title: tarefaFinal.title,
        content: buildTaskSummaryBlocks(tarefaFinal, profiles, projects),
        project_id: tarefaFinal.project_id,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (pagina) {
      await supabase
        .from("tasks")
        .update({ page_id: pagina.id })
        .eq("id", tarefaFinal.id);
      tarefaFinal = { ...tarefaFinal, page_id: pagina.id };
    }

    const resolvedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("task_requests")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId || null,
        demand_type: demandType || null,
        context_status: contextStatus || null,
        urgency: urgency || null,
        due_date: dueDate || null,
        drive_url: driveUrl.trim() || null,
        requested_to: requestedTo,
        requested_by_label: currentUserLabel,
        status: "accepted",
        task_id: tarefaFinal.id,
        resolved_at: resolvedAt,
      })
      .select()
      .single();

    setSalvando(false);
    if (error || !data) {
      setErroEnvio(
        "A tarefa foi criada, mas não deu pra registrar o pedido em Solicitações. Confere se a migration 0019_task_requests_extra_fields.sql já foi rodada no Supabase."
      );
      return;
    }

    setRequests((current) =>
      current.some((r) => r.id === data.id) ? current : [data, ...current]
    );
    limparForm();
    setSucesso(true);
    setTimeout(() => setSucesso(false), 4000);
  }

  function statusInfo(status: TaskRequest["status"]): { texto: string; tone: BadgeTone } {
    if (status === "pending") return { texto: "Pendente", tone: "warning" };
    if (status === "accepted") return { texto: "Criada", tone: "success" };
    return { texto: "Recusada", tone: "neutral" };
  }

  const linkDriveValido = /^https?:\/\//i.test(driveUrl.trim());
  const lista = aba === "recebidas" ? recebidas : enviadas;

  return (
    <div>
      <PageHeader
        title="Solicitações de tarefa"
        subtitle="Envie uma demanda para um membro da equipe e acompanhe seu andamento."
        actions={
          mostrarForm ? (
            <Button variant="ghost" size="sm" onClick={fecharForm}>
              Cancelar
            </Button>
          ) : (
            <Button onClick={() => setMostrarForm(true)}>
              <PlusIcon className="h-4 w-4" />
              Nova solicitação
            </Button>
          )
        }
      />

      {sucesso && (
        <div className="mb-5 rounded-xl border border-success/30 bg-success-light px-4 py-3 text-sm text-success">
          Solicitação enviada com sucesso.
        </div>
      )}

      <div className="mb-5 inline-flex rounded-lg border border-line bg-surface p-1">
        <button
          onClick={() => setAba("recebidas")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            aba === "recebidas"
              ? "bg-brand text-navy"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink"
          }`}
        >
          Recebidas
        </button>
        <button
          onClick={() => setAba("enviadas")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            aba === "enviadas"
              ? "bg-brand text-navy"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink"
          }`}
        >
          Enviadas
        </button>
      </div>

      {mostrarForm && (
        <div className="mb-6 space-y-4">
          <FormSection
            title="Informações da demanda"
            description="Defina o que precisa ser feito e para qual contexto."
          >
            <Campo label="Nome da demanda" required error={erroTitulo}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escreva um nome para a demanda"
                aria-required="true"
                aria-invalid={!!erroTitulo}
                className={campoClasse}
              />
            </Campo>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Tipo de demanda">
                <select
                  value={demandType}
                  onChange={(e) => setDemandType(e.target.value)}
                  className={campoClasse}
                >
                  <option value="">Selecione</option>
                  {DEMAND_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Pedir pra quem?" required error={erroResponsavel}>
                <select
                  value={requestedTo}
                  onChange={(e) => setRequestedTo(e.target.value)}
                  aria-required="true"
                  aria-invalid={!!erroResponsavel}
                  className={campoClasse}
                >
                  <option value="">Selecione</option>
                  {profiles
                    .filter((p) => p.id !== currentUserId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.username}
                      </option>
                    ))}
                </select>
              </Campo>
            </div>
          </FormSection>

          <FormSection
            title="Contexto"
            description="Relacione a demanda a um projeto (cada projeto é um cliente)."
          >
            <Campo label="Projeto">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={campoClasse}
              >
                <option value="">Sem projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Campo>
          </FormSection>

          <FormSection title="Planejamento">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Campo label="Status">
                <select
                  value={contextStatus}
                  onChange={(e) => setContextStatus(e.target.value)}
                  className={campoClasse}
                >
                  <option value="">Selecione</option>
                  {CONTEXT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Urgência">
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className={campoClasse}
                >
                  <option value="">Selecione</option>
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Prazo">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={campoClasse}
                />
              </Campo>
            </div>
          </FormSection>

          <FormSection
            title="Materiais de apoio"
            description="Adicione materiais que ajudem a equipe a executar a demanda."
          >
            <Campo label="Drive com materiais">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="Cole a URL do Drive"
                    className={`${campoClasse} pl-9`}
                  />
                </div>
                {linkDriveValido && (
                  <a
                    href={driveUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 text-xs font-medium text-brand hover:underline"
                  >
                    Abrir link
                  </a>
                )}
              </div>
            </Campo>
          </FormSection>

          <FormSection
            title="Detalhes da demanda"
            description="Explique com detalhes o que precisa ser desenvolvido."
          >
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Descrição</span>
                <span className="text-xs text-ink-muted">
                  {description.length}/{DESCRICAO_MAX}
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESCRICAO_MAX))}
                placeholder="Adicione aqui detalhadamente qual é a ideia que você quer desenvolver"
                rows={5}
                maxLength={DESCRICAO_MAX}
                className={campoClasse}
              />
            </div>
          </FormSection>

          <div className="flex flex-col items-end gap-1.5">
            {erroEnvio && <p className="text-sm text-danger">{erroEnvio}</p>}
            <Button onClick={criarSolicitacao} disabled={salvando}>
              {salvando ? "Enviando..." : "Enviar solicitação"}
            </Button>
            <p className="text-xs text-ink-muted">
              Você poderá acompanhar esta solicitação na aba Enviadas.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {lista.map((req) => {
          const s = statusInfo(req.status);
          const contexto = req.project_id ? projectsById[req.project_id]?.name : null;
          return (
            <div
              key={req.id}
              className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{req.title}</p>
                  {contexto && (
                    <p className="mt-1 text-xs text-ink-muted">{contexto}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    {aba === "recebidas"
                      ? `Enviado por ${req.requested_by_label || nomeDe(req.requested_by)}`
                      : `Pedido para ${nomeDe(req.requested_to)}`}
                  </p>
                  {req.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                      {req.description}
                    </p>
                  )}
                  {req.status === "accepted" && req.task_id && (
                    <Link
                      href={req.project_id ? `/projetos/${req.project_id}` : "/board"}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      Ver tarefa →
                    </Link>
                  )}
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {req.urgency && (
                      <Badge tone={URGENCY_TONE[req.urgency] ?? "neutral"}>
                        {req.urgency}
                      </Badge>
                    )}
                    <Badge tone={s.tone}>{s.texto}</Badge>
                  </div>
                  <span className="text-xs text-ink-muted">
                    {formatarDataHora(req.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {lista.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              className="py-14"
              icon={<InboxIcon className="h-7 w-7" />}
              title={
                aba === "recebidas"
                  ? "Nenhuma solicitação recebida"
                  : "Nenhuma solicitação enviada"
              }
              description={
                aba === "recebidas"
                  ? "Quando alguém enviar uma demanda para você, ela aparecerá aqui."
                  : "Suas solicitações enviadas vão aparecer aqui."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Campo({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
