"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, TaskRequest } from "@/lib/types";

type Aba = "recebidas" | "enviadas";

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
  const [processando, setProcessando] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedTo, setRequestedTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const profilesById = useMemo(() => {
    const mapa: Record<string, Profile> = {};
    profiles.forEach((p) => {
      mapa[p.id] = p;
    });
    return mapa;
  }, [profiles]);

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
  const pendentesRecebidas = recebidas.filter(
    (r) => r.status === "pending"
  ).length;

  async function criarSolicitacao() {
    if (!title.trim()) {
      setErro("Dá um nome pra tarefa antes de enviar.");
      return;
    }
    if (!requestedTo) {
      setErro("Escolhe pra quem é a solicitação.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const { data, error } = await supabase
      .from("task_requests")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId || null,
        requested_to: requestedTo,
        requested_by_label: currentUserLabel,
      })
      .select()
      .single();

    setSalvando(false);
    if (error || !data) {
      setErro(
        "Não deu pra enviar a solicitação. Confere se a migration 0016_task_requests.sql já foi rodada no Supabase."
      );
      return;
    }

    setRequests((current) =>
      current.some((r) => r.id === data.id) ? current : [data, ...current]
    );
    setTitle("");
    setDescription("");
    setRequestedTo("");
    setProjectId("");
    setMostrarForm(false);
  }

  async function aceitar(req: TaskRequest) {
    setProcessando(req.id);

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
        title: req.title,
        description: req.description,
        status: "todo",
        position: proximaPosicao,
        project_id: req.project_id,
        assigned_to: currentUserId,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    if (erroTarefa || !novaTarefa) {
      window.alert("Não deu pra criar a tarefa a partir do pedido. Tenta de novo.");
      setProcessando(null);
      return;
    }

    const resolvedAt = new Date().toISOString();
    const { data: pedidoAtualizado } = await supabase
      .from("task_requests")
      .update({
        status: "accepted",
        task_id: novaTarefa.id,
        resolved_at: resolvedAt,
      })
      .eq("id", req.id)
      .select()
      .single();

    setProcessando(null);
    if (pedidoAtualizado) {
      setRequests((current) =>
        current.map((r) => (r.id === req.id ? pedidoAtualizado : r))
      );
    }
  }

  async function recusar(req: TaskRequest) {
    setProcessando(req.id);
    const resolvedAt = new Date().toISOString();
    const { data: pedidoAtualizado } = await supabase
      .from("task_requests")
      .update({ status: "declined", resolved_at: resolvedAt })
      .eq("id", req.id)
      .select()
      .single();

    setProcessando(null);
    if (pedidoAtualizado) {
      setRequests((current) =>
        current.map((r) => (r.id === req.id ? pedidoAtualizado : r))
      );
    }
  }

  function statusLabel(status: TaskRequest["status"]) {
    if (status === "pending") return { texto: "Pendente", classe: "bg-amber-50 text-amber-600 border-amber-200" };
    if (status === "accepted") return { texto: "Aceita", classe: "bg-emerald-50 text-emerald-600 border-emerald-200" };
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
            {pendentesRecebidas > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {pendentesRecebidas}
              </span>
            )}
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
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da tarefa"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={requestedTo}
              onChange={(e) => setRequestedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Pedir pra quem?</option>
              {profiles
                .filter((p) => p.id !== currentUserId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.username}
                  </option>
                ))}
            </select>
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
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            onClick={criarSolicitacao}
            disabled={salvando}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {lista.map((req) => {
          const s = statusLabel(req.status);
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
                  <p className="mt-2 text-xs text-slate-400">
                    {aba === "recebidas"
                      ? `Pedido por ${req.requested_by_label || nomeDe(req.requested_by)}`
                      : `Pedido pra ${nomeDe(req.requested_to)}`}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${s.classe}`}
                >
                  {s.texto}
                </span>
              </div>

              {aba === "recebidas" && req.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => aceitar(req)}
                    disabled={processando === req.id}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    ✓ Aceitar
                  </button>
                  <button
                    onClick={() => recusar(req)}
                    disabled={processando === req.id}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              )}

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
              : "Você ainda não pediu nenhuma tarefa."}
          </p>
        )}
      </div>
    </div>
  );
}
