"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Subtask, SubtaskStatus } from "@/lib/types";
import { nomeParaMencao } from "@/lib/mencoes";
import { XIcon } from "./ui/icons";

const STATUS: { key: SubtaskStatus; label: string }[] = [
  { key: "todo", label: "A fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "approval", label: "Em aprovação" },
  { key: "done", label: "Concluída" },
];

const campo =
  "rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Menu "Subtarefas" da tarefa (migration 0065): itens menores com título,
// responsável, prazo e status. Não viram tarefas do quadro; a tarefa só
// mostra o progresso. Concluir a tarefa com subtarefas abertas é permitido
// (a tela só avisa).
export default function SubtarefasTab({
  taskId,
  pessoas,
  aoMudar,
}: {
  taskId: string;
  pessoas: Profile[];
  // Avisa o modal pra atualizar o contador do menu.
  aoMudar: () => void;
}) {
  const supabase = createClient();
  const [itens, setItens] = useState<Subtask[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");

  useEffect(() => {
    let ativo = true;
    supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        setErro(error ? "Não deu pra carregar as subtarefas. Confere se a migration 0065_subtarefas.sql já foi rodada no Supabase." : null);
        setItens((data ?? []) as Subtask[]);
        setCarregando(false);
      });

    const canal = supabase
      .channel(`subtarefas-${taskId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_subtasks" }, (payload) => {
        setItens((atual) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as Subtask;
            if (n.task_id !== taskId || atual.some((i) => i.id === n.id)) return atual;
            return [...atual, n].sort((a, b) => a.position - b.position);
          }
          if (payload.eventType === "UPDATE") {
            const n = payload.new as Subtask;
            if (n.task_id !== taskId) return atual;
            return atual.map((i) => (i.id === n.id ? { ...i, ...n } : i));
          }
          if (payload.eventType === "DELETE") {
            const id = (payload.old as Subtask).id;
            return atual.filter((i) => i.id !== id);
          }
          return atual;
        });
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const titulo = novo.trim();
    if (!titulo) return;
    setErro(null);
    const posicao = itens.reduce((m, i) => Math.max(m, i.position), 0) + 1;
    const { data, error } = await supabase
      .from("task_subtasks")
      .insert({ task_id: taskId, title: titulo, position: posicao })
      .select()
      .single();
    if (error || !data) return setErro("Não foi possível criar a subtarefa. Tente de novo.");
    setItens((atual) => (atual.some((i) => i.id === data.id) ? atual : [...atual, data as Subtask]));
    setNovo("");
    aoMudar();
  }

  async function alterar(item: Subtask, campos: Partial<Pick<Subtask, "status" | "assigned_to" | "due_date" | "title">>) {
    const antes = item;
    setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, ...campos } : i)));
    const { error } = await supabase.from("task_subtasks").update(campos).eq("id", item.id);
    if (error) {
      setItens((atual) => atual.map((i) => (i.id === item.id ? antes : i)));
      return setErro("Não foi possível salvar a alteração. Tente de novo.");
    }
    setErro(null);
    if ("status" in campos) aoMudar();
  }

  async function remover(item: Subtask) {
    if (!window.confirm(`Excluir a subtarefa "${item.title}"?`)) return;
    const { error } = await supabase.from("task_subtasks").delete().eq("id", item.id);
    if (error) return setErro("Não foi possível excluir a subtarefa.");
    setItens((atual) => atual.filter((i) => i.id !== item.id));
    aoMudar();
  }

  function salvarTitulo(item: Subtask) {
    const titulo = tituloEditado.trim();
    setEditando(null);
    if (titulo && titulo !== item.title) alterar(item, { title: titulo });
  }

  const concluidas = itens.filter((i) => i.status === "done").length;

  return (
    <div>
      {itens.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-ink-muted">
            {concluidas}/{itens.length} concluída{concluidas === 1 ? "" : "s"}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-brand-forte" style={{ width: `${(concluidas / itens.length) * 100}%` }} />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {itens.map((item) => {
          const feita = item.status === "done";
          return (
            <li key={item.id} className="rounded-lg border border-line bg-canvas px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={feita}
                  onChange={() => alterar(item, { status: feita ? "todo" : "done" })}
                  aria-label={feita ? "Reabrir subtarefa" : "Concluir subtarefa"}
                />
                {editando === item.id ? (
                  <input
                    autoFocus
                    value={tituloEditado}
                    onChange={(e) => setTituloEditado(e.target.value)}
                    onBlur={() => salvarTitulo(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") salvarTitulo(item);
                      if (e.key === "Escape") setEditando(null);
                    }}
                    maxLength={200}
                    className={`${campo} min-w-0 flex-1 text-sm`}
                  />
                ) : (
                  <button
                    type="button"
                    title="Clique pra editar o nome"
                    onClick={() => {
                      setEditando(item.id);
                      setTituloEditado(item.title);
                    }}
                    className={`min-w-0 flex-1 truncate text-left text-sm ${feita ? "text-ink-muted line-through" : "text-ink"}`}
                  >
                    {item.title}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remover(item)}
                  aria-label="Excluir subtarefa"
                  className="text-ink-muted hover:text-danger"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                <select
                  value={item.status}
                  onChange={(e) => alterar(item, { status: e.target.value as SubtaskStatus })}
                  aria-label="Status da subtarefa"
                  className={campo}
                >
                  {STATUS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={item.assigned_to ?? ""}
                  onChange={(e) => alterar(item, { assigned_to: e.target.value || null })}
                  aria-label="Responsável pela subtarefa"
                  className={`${campo} max-w-[10rem]`}
                >
                  <option value="">Sem responsável</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nomeParaMencao(p) || "Sem nome"}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={item.due_date ?? ""}
                  onChange={(e) => alterar(item, { due_date: e.target.value || null })}
                  aria-label="Prazo da subtarefa"
                  className={campo}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {!carregando && itens.length === 0 && !erro && <p className="text-xs text-ink-muted">Nenhuma subtarefa ainda.</p>}
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}

      <form onSubmit={adicionar} className="mt-3 flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={200}
          placeholder="Nova subtarefa..."
          aria-label="Nova subtarefa"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover">
          Adicionar
        </button>
      </form>
    </div>
  );
}
