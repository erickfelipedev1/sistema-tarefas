"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import { nomeParaMencao, pessoaAtiva } from "@/lib/mencoes";
import { avisarTarefaAtribuida } from "@/lib/actions/push";
import { STATUS_OPTIONS } from "@/lib/task-options";
import { corTarefa } from "@/lib/task-colors";
import { XIcon } from "./ui/icons";

const campo =
  "rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function formatarPrazo(data: string | null) {
  return data ? data.split("-").reverse().slice(0, 2).join("/") : null;
}

// Menu "Subtarefas" da tarefa (migration 0067): cada subtarefa é uma tarefa
// completa ligada a esta por "parent_id" — tem descrição, período, vários
// responsáveis, checklist, anexos, comentários e horas, e aparece no quadro
// como qualquer outra. Aqui ficam a lista e o jeito rápido de criar; um
// clique abre a subtarefa inteira.
export default function SubtarefasTab({
  tarefa,
  pessoas,
  currentUserLabel,
  getNextPosition,
  aoCriar,
  aoAtualizar,
  aoAbrir,
  aoMudar,
}: {
  tarefa: Task;
  pessoas: Profile[];
  currentUserLabel: string;
  getNextPosition: (status: TaskStatus) => number;
  aoCriar: (t: Task) => void;
  aoAtualizar: (t: Task) => void;
  // Abre a subtarefa no lugar desta janela.
  aoAbrir: (t: Task) => void;
  // Avisa o modal pra atualizar o contador do menu.
  aoMudar: () => void;
}) {
  const supabase = createClient();
  const [itens, setItens] = useState<Task[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  // Responsável já escolhido pra subtarefa que está sendo criada (opcional).
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("tasks")
      .select("*")
      .eq("parent_id", tarefa.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        setErro(
          error ? "Não deu pra carregar as subtarefas. Confere se a migration 0067_subtarefas_como_tarefas.sql já foi rodada no Supabase." : null
        );
        setItens((data ?? []) as Task[]);
        setCarregando(false);
      });

    // Qualquer mudança nas tarefas recarrega a lista: o filtro do Realtime
    // não entrega exclusões, e uma subtarefa solta da principal some do
    // filtro sem aviso. O custo é uma consulta pequena.
    const canal = supabase
      .channel(`subtarefas-${tarefa.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        supabase
          .from("tasks")
          .select("*")
          .eq("parent_id", tarefa.id)
          .order("created_at", { ascending: true })
          .then(({ data }) => {
            if (!ativo || !data) return;
            setItens(data as Task[]);
            aoMudar();
          });
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefa.id]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const titulo = novo.trim();
    if (!titulo || criando) return;
    setCriando(true);
    setErro(null);
    const hoje = new Date().toLocaleDateString("en-CA");
    // Começa hoje e entrega junto com a tarefa principal (dá pra ajustar
    // depois, abrindo a subtarefa).
    const entrega = tarefa.due_date && tarefa.due_date >= hoje ? tarefa.due_date : hoje;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: titulo,
        parent_id: tarefa.id,
        project_id: tarefa.project_id,
        // Nasce no mesmo projeto do cliente da tarefa principal (migration 0083).
        ...(tarefa.subproject_id ? { subproject_id: tarefa.subproject_id } : {}),
        status: "todo",
        position: getNextPosition("todo"),
        start_date: hoje,
        due_date: entrega,
        repeat_rule: "none",
        color: tarefa.color,
        assigned_to: novoResponsavel ? [novoResponsavel] : [],
        created_by_label: currentUserLabel,
      })
      .select()
      .single();
    setCriando(false);
    if (error || !data) {
      return setErro(
        /parent_id/i.test(error?.message ?? "")
          ? "Confere se a migration 0067_subtarefas_como_tarefas.sql já foi rodada no Supabase."
          : `Não foi possível criar a subtarefa. ${error?.message ?? ""}`.trim()
      );
    }
    const criada = data as Task;
    setItens((atual) => (atual.some((i) => i.id === criada.id) ? atual : [...atual, criada]));
    setNovo("");
    setNovoResponsavel("");
    aoCriar(criada);
    aoMudar();
    // Push no celular de quem recebeu (o aviso do sininho vem do banco).
    if (novoResponsavel) avisarTarefaAtribuida(criada.id).catch(() => {});
  }

  // Põe ou tira responsáveis da subtarefa. Quem entra recebe o aviso.
  async function mudarResponsaveis(item: Task, proximos: string[], entrou?: string) {
    const antes = item;
    const depois = { ...item, assigned_to: proximos };
    setItens((atual) => atual.map((i) => (i.id === item.id ? depois : i)));
    const { error } = await supabase.from("tasks").update({ assigned_to: proximos }).eq("id", item.id);
    if (error) {
      setItens((atual) => atual.map((i) => (i.id === item.id ? antes : i)));
      return setErro("Não foi possível salvar o responsável. Tente de novo.");
    }
    setErro(null);
    aoAtualizar(depois);
    if (entrou) avisarTarefaAtribuida(item.id, [entrou]).catch(() => {});
  }

  async function mudarStatus(item: Task, status: TaskStatus) {
    const antes = item;
    const depois = { ...item, status };
    setItens((atual) => atual.map((i) => (i.id === item.id ? depois : i)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", item.id);
    if (error) {
      setItens((atual) => atual.map((i) => (i.id === item.id ? antes : i)));
      return setErro("Não foi possível salvar a alteração. Tente de novo.");
    }
    setErro(null);
    aoAtualizar(depois);
    aoMudar();
  }

  async function remover(item: Task) {
    if (!window.confirm(`Excluir a subtarefa "${item.title}"? Os comentários, anexos e horas dela vão junto.`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", item.id);
    if (error) return setErro("Não foi possível excluir a subtarefa.");
    setItens((atual) => atual.filter((i) => i.id !== item.id));
    aoMudar();
  }

  const ativas = itens.filter((i) => i.status !== "cancelled");
  const concluidas = ativas.filter((i) => i.status === "done").length;

  return (
    <div>
      {ativas.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-ink-muted">
            {concluidas}/{ativas.length} concluída{concluidas === 1 ? "" : "s"}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-brand-forte" style={{ width: `${(concluidas / ativas.length) * 100}%` }} />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {itens.map((item) => {
          const feita = item.status === "done";
          const responsaveis = (item.assigned_to ?? [])
            .map((id) => pessoas.find((p) => p.id === id))
            .filter((p): p is Profile => !!p);
          const prazo = formatarPrazo(item.due_date);
          return (
            <li key={item.id} className="rounded-lg border border-line bg-canvas px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={feita}
                  onChange={() => mudarStatus(item, feita ? "todo" : "done")}
                  aria-label={feita ? "Reabrir subtarefa" : "Concluir subtarefa"}
                />
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${corTarefa(item.color).dot}`} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => aoAbrir(item)}
                  title="Abrir a subtarefa"
                  className={`min-w-0 flex-1 truncate text-left text-sm hover:underline ${
                    feita ? "text-ink-muted line-through" : "text-ink"
                  }`}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  onClick={() => remover(item)}
                  aria-label="Excluir subtarefa"
                  className="text-ink-muted hover:text-danger"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-xs text-ink-muted">
                <select
                  value={item.status}
                  onChange={(e) => mudarStatus(item, e.target.value as TaskStatus)}
                  aria-label="Status da subtarefa"
                  className={campo}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {responsaveis.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-hover py-0.5 pl-2 pr-1 text-ink"
                  >
                    {nomeParaMencao(p).split(" ")[0] || "Sem nome"}
                    <button
                      type="button"
                      onClick={() =>
                        mudarResponsaveis(
                          item,
                          (item.assigned_to ?? []).filter((id) => id !== p.id)
                        )
                      }
                      aria-label={`Tirar ${nomeParaMencao(p)} da subtarefa`}
                      className="grid h-4 w-4 place-items-center rounded-full text-ink-muted hover:bg-danger-light hover:text-danger"
                    >
                      <XIcon className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) mudarResponsaveis(item, [...(item.assigned_to ?? []), id], id);
                  }}
                  aria-label="Adicionar responsável à subtarefa"
                  className={`${campo} max-w-[10rem]`}
                >
                  <option value="">{responsaveis.length === 0 ? "+ Responsável" : "+ Adicionar"}</option>
                  {pessoas
                    .filter((p) => !(item.assigned_to ?? []).includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {nomeParaMencao(p) || "Sem nome"}
                      </option>
                    ))}
                </select>
                {prazo && <span>· prazo {prazo}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {!carregando && itens.length === 0 && !erro && <p className="text-xs text-ink-muted">Nenhuma subtarefa ainda.</p>}
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}

      <form onSubmit={adicionar} className="mt-3 flex flex-wrap gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={200}
          placeholder="Nova subtarefa..."
          aria-label="Nova subtarefa"
          className="min-w-[10rem] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <select
          value={novoResponsavel}
          onChange={(e) => setNovoResponsavel(e.target.value)}
          aria-label="Responsável pela nova subtarefa"
          className="max-w-[11rem] rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Sem responsável</option>
          {pessoas.filter(pessoaAtiva).map((p) => (
            <option key={p.id} value={p.id}>
              {nomeParaMencao(p) || "Sem nome"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={criando}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}
