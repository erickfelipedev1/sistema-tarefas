"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  ChecklistItem,
  Profile,
  Project,
  RepeatRule,
  Task,
  TaskAttachment,
  TaskComment,
  TaskHourEntry,
  TaskStatus,
} from "@/lib/types";
import { CORES_TAREFA } from "@/lib/task-colors";
import { STATUS_OPTIONS, REPEAT_OPTIONS } from "@/lib/task-options";
import { syncTaskWiki } from "@/lib/task-wiki-sync";

type Aba = "detalhes" | "checklist" | "anexos" | "comentarios" | "horas";

const ABAS: { key: Aba; label: string; icone: string }[] = [
  { key: "detalhes", label: "Detalhes", icone: "📋" },
  { key: "checklist", label: "Checklist", icone: "✅" },
  { key: "anexos", label: "Anexos", icone: "📎" },
  { key: "comentarios", label: "Comentários", icone: "💬" },
  { key: "horas", label: "Horas", icone: "⏱️" },
];

export default function TaskModal({
  task,
  projectId,
  projects,
  profiles,
  currentUserLabel,
  getNextPosition,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  task: Task | null;
  projectId: string | null;
  projects: Project[];
  profiles: Profile[];
  currentUserLabel: string;
  getNextPosition: (status: TaskStatus) => number;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const supabase = createClient();
  const [current, setCurrent] = useState<Task | null>(task);
  const [aba, setAba] = useState<Aba>("detalhes");

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [dueTime, setDueTime] = useState(task?.due_time?.slice(0, 5) ?? "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(
    task?.repeat_rule ?? "none"
  );
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? "");
  const [color, setColor] = useState(task?.color ?? "gray");
  const [taskProjectId, setTaskProjectId] = useState(
    task?.project_id ?? projectId ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isNovo = !current;

  // Impede o scroll da página por trás enquanto o modal está aberto.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  async function criar() {
    if (!title.trim()) {
      setErro("Dá um nome pra tarefa antes de criar.");
      return;
    }
    setSaving(true);
    setErro(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        status,
        position: getNextPosition(status),
        due_date: dueDate || null,
        due_time: dueTime || null,
        repeat_rule: repeatRule,
        color,
        project_id: taskProjectId || null,
        assigned_to: assignedTo || null,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    setSaving(false);
    if (error || !data) {
      setErro("Não deu pra criar a tarefa. Confere se a migration 0013_task_details.sql já foi rodada no Supabase.");
      return;
    }
    setCurrent(data);
    onCreated(data);
  }

  async function salvarCampo(campos: Partial<Task>) {
    if (!current) return;
    const atualizado = { ...current, ...campos } as Task;
    setCurrent(atualizado);
    onUpdated(atualizado);
    await supabase.from("tasks").update(campos).eq("id", current.id);

    // Se essa tarefa já tem uma página vinculada na Wiki, mantém o resumo
    // lá em cima sempre atualizado com os dados mais recentes.
    if (atualizado.page_id) {
      syncTaskWiki(supabase, atualizado, profiles, projects).catch(() => {
        // Falha silenciosa: a tarefa já foi salva, só o resumo na Wiki
        // que não atualizou dessa vez — não trava o autosave por isso.
      });
    }
  }

  async function excluirTarefa() {
    if (!current) return;
    const ok = window.confirm(
      "Excluir esta tarefa? Essa ação não pode ser desfeita."
    );
    if (!ok) return;
    await supabase.from("tasks").delete().eq("id", current.id);
    onDeleted(current.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl md:flex-row"
      >
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-1 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {isNovo ? "Nova tarefa" : "Atualize aqui sua tarefa"}
            </h2>
            <button
              onClick={onClose}
              className="text-xl leading-none text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          {!isNovo && (
            <p className="mb-4 text-xs text-slate-400">
              As alterações são salvas automaticamente.
            </p>
          )}
          {erro && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {erro}
            </p>
          )}

          {aba === "detalhes" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Nome da tarefa *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() =>
                    !isNovo &&
                    title.trim() &&
                    title.trim() !== current?.title &&
                    salvarCampo({ title: title.trim() })
                  }
                  placeholder="Nome da tarefa..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() =>
                    !isNovo &&
                    salvarCampo({ description: description.trim() || null })
                  }
                  rows={4}
                  placeholder="Detalhes da tarefa..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">
                  Status
                </label>
                <div className="flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-1.5 text-sm text-slate-600"
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={status === opt.key}
                        onChange={() => {
                          setStatus(opt.key);
                          if (!isNovo) salvarCampo({ status: opt.key });
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Data
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      if (!isNovo) salvarCampo({ due_date: e.target.value || null });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => {
                      setDueTime(e.target.value);
                      if (!isNovo) salvarCampo({ due_time: e.target.value || null });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Repetir
                  </label>
                  <select
                    value={repeatRule}
                    onChange={(e) => {
                      const v = e.target.value as RepeatRule;
                      setRepeatRule(v);
                      if (!isNovo) salvarCampo({ repeat_rule: v });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
                  >
                    {REPEAT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {repeatRule !== "none" && (
                <p className="-mt-2 text-xs text-slate-400">
                  A recorrência é só uma lembrança por enquanto — ainda não
                  recria a tarefa automaticamente.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Responsável
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => {
                      setAssignedTo(e.target.value);
                      if (!isNovo)
                        salvarCampo({ assigned_to: e.target.value || null });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="">Ninguém</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.username || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                {projects.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      Projeto
                    </label>
                    <select
                      value={taskProjectId}
                      onChange={(e) => {
                        setTaskProjectId(e.target.value);
                        if (!isNovo)
                          salvarCampo({ project_id: e.target.value || null });
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Geral</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Cor
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-2">
                    {CORES_TAREFA.map((cor) => (
                      <button
                        key={cor.key}
                        type="button"
                        title={cor.nome}
                        onClick={() => {
                          setColor(cor.key);
                          if (!isNovo) salvarCampo({ color: cor.key });
                        }}
                        className={`h-4 w-4 rounded-full ${cor.dot} ${
                          color === cor.key
                            ? "ring-2 ring-slate-400 ring-offset-1"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!isNovo && current?.due_date && (
                <Link
                  href="/calendario"
                  className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  📅 Ver no Calendário
                </Link>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                {isNovo ? (
                  <button
                    onClick={criar}
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? "Criando..." : "Criar tarefa"}
                  </button>
                ) : (
                  <button
                    onClick={excluirTarefa}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    Excluir tarefa
                  </button>
                )}
              </div>

              {isNovo && (
                <p className="text-xs text-slate-400">
                  Checklist, anexos, comentários e horas ficam disponíveis
                  depois de criar a tarefa.
                </p>
              )}
            </div>
          )}

          {aba === "checklist" && current && (
            <ChecklistTab taskId={current.id} />
          )}
          {aba === "anexos" && current && (
            <AnexosTab taskId={current.id} currentUserLabel={currentUserLabel} />
          )}
          {aba === "comentarios" && current && (
            <ComentariosTab
              taskId={current.id}
              currentUserLabel={currentUserLabel}
            />
          )}
          {aba === "horas" && current && (
            <HorasTab taskId={current.id} currentUserLabel={currentUserLabel} />
          )}
        </div>

        <div className="flex flex-shrink-0 flex-row gap-1 border-t border-slate-100 bg-slate-50 p-2 md:w-40 md:flex-col md:border-l md:border-t-0">
          <p className="hidden px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 md:block">
            Menu
          </p>
          {ABAS.map((item) => (
            <button
              key={item.key}
              disabled={item.key !== "detalhes" && isNovo}
              onClick={() => setAba(item.key)}
              className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
                aba === item.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{item.icone}</span>
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChecklistTab({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true });
      if (ativo) {
        setItems(data ?? []);
        setCarregando(false);
      }
    })();

    const channel = supabase
      .channel(`checklist-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_checklist_items" },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as ChecklistItem;
              if (novo.task_id !== taskId) return current;
              if (current.some((i) => i.id === novo.id)) return current;
              return [...current, novo].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const at = payload.new as ChecklistItem;
              if (at.task_id !== taskId) return current;
              return current.map((i) => (i.id === at.id ? at : i));
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as ChecklistItem).id;
              return current.filter((i) => i.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoItem.trim()) return;
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), 0);
    const { data, error } = await supabase
      .from("task_checklist_items")
      .insert({ task_id: taskId, title: novoItem.trim(), position: maxPos + 1 })
      .select()
      .single();
    if (!error && data) {
      setItems((c) => (c.some((i) => i.id === data.id) ? c : [...c, data]));
      setNovoItem("");
    }
  }

  async function alternar(item: ChecklistItem) {
    setItems((c) =>
      c.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    );
    await supabase
      .from("task_checklist_items")
      .update({ done: !item.done })
      .eq("id", item.id);
  }

  async function remover(item: ChecklistItem) {
    setItems((c) => c.filter((i) => i.id !== item.id));
    await supabase.from("task_checklist_items").delete().eq("id", item.id);
  }

  const feitos = items.filter((i) => i.done).length;

  return (
    <div>
      {items.length > 0 && (
        <p className="mb-2 text-xs text-slate-400">
          {feitos}/{items.length} concluídos
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => alternar(item)}
            />
            <span
              className={`flex-1 text-sm ${
                item.done ? "text-slate-400 line-through" : "text-slate-700"
              }`}
            >
              {item.title}
            </span>
            <button
              onClick={() => remover(item)}
              className="text-xs text-slate-300 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {!carregando && items.length === 0 && (
          <p className="text-xs text-slate-400">Nenhum item ainda.</p>
        )}
      </div>
      <form onSubmit={adicionar} className="mt-3 flex gap-2">
        <input
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          placeholder="Novo item..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}

function AnexosTab({
  taskId,
  currentUserLabel,
}: {
  taskId: string;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [anexos, setAnexos] = useState<TaskAttachment[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (ativo) setAnexos(data ?? []);
    })();

    const channel = supabase
      .channel(`anexos-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_attachments" },
        (payload) => {
          setAnexos((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as TaskAttachment;
              if (novo.task_id !== taskId) return current;
              if (current.some((a) => a.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as TaskAttachment).id;
              return current.filter((a) => a.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    const caminho = `${taskId}/${Date.now()}-${arquivo.name}`;
    const { error: erroUpload } = await supabase.storage
      .from("task-attachments")
      .upload(caminho, arquivo);

    if (erroUpload) {
      window.alert(
        "Não consegui enviar o arquivo. Confere se a migration 0013_task_details.sql já foi rodada (ela cria o bucket de anexos)."
      );
      setEnviando(false);
      e.target.value = "";
      return;
    }

    const { data, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id: taskId,
        file_name: arquivo.name,
        file_path: caminho,
        uploaded_by_label: currentUserLabel,
      })
      .select()
      .single();

    setEnviando(false);
    e.target.value = "";
    if (!error && data) {
      setAnexos((c) => (c.some((a) => a.id === data.id) ? c : [data, ...c]));
    }
  }

  async function remover(anexo: TaskAttachment) {
    setAnexos((c) => c.filter((a) => a.id !== anexo.id));
    await supabase.storage.from("task-attachments").remove([anexo.file_path]);
    await supabase.from("task_attachments").delete().eq("id", anexo.id);
  }

  function urlPublica(caminho: string) {
    return supabase.storage.from("task-attachments").getPublicUrl(caminho).data
      .publicUrl;
  }

  return (
    <div>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          {enviando ? "Enviando..." : "Anexar arquivo"}
        </span>
        <input
          type="file"
          onChange={enviarArquivo}
          disabled={enviando}
          className="block w-full text-sm text-slate-600"
        />
      </label>
      <div className="space-y-1">
        {anexos.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
          >
            <a
              href={urlPublica(a.file_path)}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm text-slate-700 hover:underline"
            >
              📎 {a.file_name}
            </a>
            <button
              onClick={() => remover(a)}
              className="flex-shrink-0 text-xs text-slate-300 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {anexos.length === 0 && (
          <p className="text-xs text-slate-400">Nenhum anexo ainda.</p>
        )}
      </div>
    </div>
  );
}

function ComentariosTab({
  taskId,
  currentUserLabel,
}: {
  taskId: string;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [comentarios, setComentarios] = useState<TaskComment[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (ativo) setComentarios(data ?? []);
    })();

    const channel = supabase
      .channel(`comentarios-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const novo = payload.new as TaskComment;
            if (novo.task_id !== taskId) return;
            setComentarios((current) =>
              current.some((c) => c.id === novo.id) ? current : [...current, novo]
            );
          }
          if (payload.eventType === "DELETE") {
            const id = (payload.old as TaskComment).id;
            setComentarios((current) => current.filter((c) => c.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        content: novoComentario.trim(),
        created_by_label: currentUserLabel,
      })
      .select()
      .single();
    if (!error && data) {
      setComentarios((c) => (c.some((cm) => cm.id === data.id) ? c : [...c, data]));
      setNovoComentario("");
    }
  }

  return (
    <div>
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {comentarios.map((c) => (
          <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-700">{c.content}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              {c.created_by_label ?? "Alguém"} ·{" "}
              {new Date(c.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
        {comentarios.length === 0 && (
          <p className="text-xs text-slate-400">Nenhum comentário ainda.</p>
        )}
      </div>
      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={novoComentario}
          onChange={(e) => setNovoComentario(e.target.value)}
          placeholder="Escreva um comentário..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function HorasTab({
  taskId,
  currentUserLabel,
}: {
  taskId: string;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [lancamentos, setLancamentos] = useState<TaskHourEntry[]>([]);
  const [horas, setHoras] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_hours")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (ativo) setLancamentos(data ?? []);
    })();

    const channel = supabase
      .channel(`horas-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_hours" },
        (payload) => {
          setLancamentos((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as TaskHourEntry;
              if (novo.task_id !== taskId) return current;
              if (current.some((h) => h.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as TaskHourEntry).id;
              return current.filter((h) => h.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseFloat(horas.replace(",", "."));
    if (!valor || valor <= 0) return;
    const { data, error } = await supabase
      .from("task_hours")
      .insert({
        task_id: taskId,
        hours: valor,
        note: nota.trim() || null,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();
    if (!error && data) {
      setLancamentos((c) => (c.some((h) => h.id === data.id) ? c : [data, ...c]));
      setHoras("");
      setNota("");
    }
  }

  async function remover(item: TaskHourEntry) {
    setLancamentos((c) => c.filter((h) => h.id !== item.id));
    await supabase.from("task_hours").delete().eq("id", item.id);
  }

  const total = lancamentos.reduce((soma, h) => soma + Number(h.hours), 0);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Total lançado: <strong>{total.toLocaleString("pt-BR")}h</strong>
      </p>
      <form onSubmit={lancar} className="mb-3 flex flex-wrap gap-2">
        <input
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
          placeholder="Horas (ex: 1.5)"
          inputMode="decimal"
          className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="O que foi feito (opcional)"
          className="min-w-[150px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Lançar
        </button>
      </form>
      <div className="space-y-1">
        {lancamentos.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium text-slate-700">
                {Number(h.hours).toLocaleString("pt-BR")}h
              </span>
              {h.note && <span className="ml-2 text-slate-500">— {h.note}</span>}
              {h.created_by_label && (
                <span className="ml-2 text-xs text-slate-400">
                  por {h.created_by_label}
                </span>
              )}
            </div>
            <button
              onClick={() => remover(h)}
              className="text-xs text-slate-300 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {lancamentos.length === 0 && (
          <p className="text-xs text-slate-400">Nenhum lançamento ainda.</p>
        )}
      </div>
    </div>
  );
}
