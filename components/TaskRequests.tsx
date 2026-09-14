"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Client, Profile, Project, Task, TaskRequest } from "@/lib/types";
import { buildTaskSummaryBlocks } from "@/lib/task-wiki-sync";

type Aba = "recebidas" | "enviadas";

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

const DESCRICAO_MAX = 2000;

export default function TaskRequests({
  currentUserId,
  currentUserLabel,
  initialRequests,
  profiles,
  projects,
  clients,
}: {
  currentUserId: string;
  currentUserLabel: string;
  initialRequests: TaskRequest[];
  profiles: Profile[];
  projects: Project[];
  clients: Client[];
}) {
  const supabase = createClient();
  const [requests, setRequests] = useState<TaskRequest[]>(initialRequests);
  const [aba, setAba] = useState<Aba>("recebidas");
  const [mostrarForm, setMostrarForm] = useState(false);

  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [requestedTo, setRequestedTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contextStatus, setContextStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [description, setDescription] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const profilesById = useMemo(() => {
    const mapa: Record<string, Profile> = {};
    profiles.forEach((p) => {
      mapa[p.id] = p;
    });
    return mapa;
  }, [profiles]);

  const clientsById = useMemo(() => {
    const mapa: Record<string, Client> = {};
    clients.forEach((c) => {
      mapa[c.id] = c;
    });
    return mapa;
  }, [clients]);

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

  function limparForm() {
    setTitle("");
    setDemandType("");
    setRequestedTo("");
    setClientId("");
    setProjectId("");
    setContextStatus("");
    setUrgency("");
    setDriveUrl("");
    setDescription("");
    setMostrarForm(false);
  }

  // Ao enviar, a tarefa já é criada na hora — não fica esperando ninguém
  // aceitar ou recusar. O pedido fica registrado (pra aparecer em
  // "Enviadas"/"Recebidas"), já com status "accepted" e ligado à tarefa.
  async function criarSolicitacao() {
    if (!title.trim()) {
      setErro("Dá um nome pra demanda antes de enviar.");
      return;
    }
    if (!requestedTo) {
      setErro("Escolhe pra quem é a solicitação.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const nomeCliente = clientId ? clientsById[clientId]?.name : null;
    const detalhes: string[] = [];
    if (demandType) detalhes.push(`Tipo de demanda: ${demandType}`);
    if (nomeCliente) detalhes.push(`Empresa: ${nomeCliente}`);
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
        assigned_to: [requestedTo],
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (erroTarefa || !novaTarefa) {
      setSalvando(false);
      setErro("Não deu pra criar a tarefa a partir do pedido. Tenta de novo.");
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
        client_id: clientId || null,
        demand_type: demandType || null,
        context_status: contextStatus || null,
        urgency: urgency || null,
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
      setErro(
        "A tarefa foi criada, mas não deu pra registrar o pedido em Solicitações. Confere se a migration 0019_task_requests_extra_fields.sql já foi rodada no Supabase."
      );
      return;
    }

    setRequests((current) =>
      current.some((r) => r.id === data.id) ? current : [data, ...current]
    );
    limparForm();
  }

  function statusLabel(status: TaskRequest["status"]) {
    if (status === "pending") return { texto: "Pendente", classe: "bg-amber-50 text-amber-600 border-amber-200" };
    if (status === "accepted") return { texto: "Criada", classe: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    return { texto: "Recusada", classe: "bg-slate-100 text-slate-500 border-slate-200" };
  }

  const lista = aba === "recebidas" ? recebidas : enviadas;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
          <button
            onClick={() => setAba("recebidas")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              aba === "recebidas"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Recebidas
          </button>
          <button
            onClick={() => setAba("enviadas")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              aba === "enviadas"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Enviadas
          </button>
        </div>

        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {mostrarForm ? "Cancelar" : "+ Nova solicitação"}
        </button>
      </div>

      {mostrarForm && (
        <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Nome da Demanda
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Escreva um nome para a demanda"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Tipo de demanda
              </label>
              <select
                value={demandType}
                onChange={(e) => setDemandType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {DEMAND_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Pedir pra quem?
              </label>
              <select
                value={requestedTo}
                onChange={(e) => setRequestedTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Qual Empresa?
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sem empresa</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Projeto
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sem projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Status
              </label>
              <select
                value={contextStatus}
                onChange={(e) => setContextStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {CONTEXT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Urgência
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {URGENCY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Drive com materiais
            </label>
            <input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="Cole a url do drive"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Escreva sua ideia</span>
              <span className="text-slate-400">
                {description.length}/{DESCRICAO_MAX}
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRICAO_MAX))}
              placeholder="Adicione aqui detalhadamente qual é a ideia que você quer desenvolver"
              rows={3}
              maxLength={DESCRICAO_MAX}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            onClick={criarSolicitacao}
            disabled={salvando}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {lista.map((req) => {
          const s = statusLabel(req.status);
          const nomeCliente = req.client_id ? clientsById[req.client_id]?.name : null;
          return (
            <div
              key={req.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {req.title}
                  </p>
                  {req.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {req.description}
                    </p>
                  )}
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-400">
                    <span>
                      {aba === "recebidas"
                        ? `Pedido por ${req.requested_by_label || nomeDe(req.requested_by)}`
                        : `Pedido pra ${nomeDe(req.requested_to)}`}
                    </span>
                    {req.demand_type && <span>· {req.demand_type}</span>}
                    {nomeCliente && <span>· {nomeCliente}</span>}
                    {req.urgency && <span>· Urgência: {req.urgency}</span>}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${s.classe}`}
                >
                  {s.texto}
                </span>
              </div>

              {req.status === "accepted" && req.task_id && (
                <Link
                  href={req.project_id ? `/projetos/${req.project_id}` : "/board"}
                  className="mt-3 inline-block text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Ver tarefa →
                </Link>
              )}
            </div>
          );
        })}

        {lista.length === 0 && (
          <p className="text-sm text-slate-400">
            {aba === "recebidas"
              ? "Nenhuma solicitação recebida ainda."
              : "Você ainda não pediu nenhuma demanda."}
          </p>
        )}
      </div>
    </div>
  );
}
