"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarCatalogo, type Etiqueta } from "@/lib/etiquetas";
import { CORES_TAREFA, corTarefa } from "@/lib/task-colors";
import { XIcon } from "./ui/icons";

// Selo colorido de uma etiqueta (cartão do quadro, modal da tarefa).
export function EtiquetaSelo({ etiqueta, aoTirar }: { etiqueta: Pick<Etiqueta, "name" | "color">; aoTirar?: () => void }) {
  const cor = corTarefa(etiqueta.color);
  return (
    <span
      style={{ backgroundColor: cor.fundo, color: cor.texto }}
      className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-4"
    >
      <span className="truncate">{etiqueta.name}</span>
      {aoTirar && (
        <button
          type="button"
          onClick={aoTirar}
          aria-label={`Tirar a etiqueta ${etiqueta.name}`}
          className="opacity-80 hover:opacity-100"
        >
          <XIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

const campo =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Etiquetas dentro da tarefa (aba Detalhes): as que ela tem, com ✕ pra tirar;
// "+ Etiqueta" pra colocar uma que já existe; "Nova etiqueta" cria (nome + cor) e
// já põe na tarefa. As etiquetas são de todo mundo; apagar uma do catálogo é
// de quem criou (ou da liderança) — o banco confere.
export default function EtiquetasDaTarefa({ taskId, aoMudar }: { taskId: string; aoMudar: () => void }) {
  const supabase = createClient();
  const [catalogo, setCatalogo] = useState<Etiqueta[]>([]);
  const [ligadas, setLigadas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("blue");
  const [gerenciando, setGerenciando] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      carregarCatalogo(supabase),
      supabase.from("task_label_links").select("label_id").eq("task_id", taskId),
    ]).then(([lista, ligacoes]) => {
      if (!ativo) return;
      setCatalogo(lista);
      setLigadas(((ligacoes.data ?? []) as { label_id: string }[]).map((l) => l.label_id));
      setErro(ligacoes.error ? "Confere se a migration 0069_etiquetas.sql já foi rodada no Supabase." : null);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function colocar(id: string) {
    if (ligadas.includes(id)) return;
    setLigadas((a) => [...a, id]);
    const { error } = await supabase.from("task_label_links").insert({ task_id: taskId, label_id: id });
    if (error) {
      setLigadas((a) => a.filter((x) => x !== id));
      return setErro("Não foi possível colocar a etiqueta. Tente de novo.");
    }
    setErro(null);
    aoMudar();
  }

  async function tirar(id: string) {
    setLigadas((a) => a.filter((x) => x !== id));
    const { error } = await supabase.from("task_label_links").delete().eq("task_id", taskId).eq("label_id", id);
    if (error) {
      setLigadas((a) => [...a, id]);
      return setErro("Não foi possível tirar a etiqueta. Tente de novo.");
    }
    setErro(null);
    aoMudar();
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = nome.trim();
    if (!limpo) return;
    // Já existe uma com esse nome (sem diferenciar maiúscula)? Só põe ela.
    const existente = catalogo.find((c) => c.name.trim().toLowerCase() === limpo.toLowerCase());
    if (existente) {
      await colocar(existente.id);
      setNome("");
      setCriando(false);
      return;
    }
    const { data, error } = await supabase.from("task_labels").insert({ name: limpo, color: cor }).select().single();
    if (error || !data) {
      return setErro("Não foi possível criar a etiqueta. Tente de novo.");
    }
    setCatalogo((a) => [...a, data as Etiqueta].sort((x, y) => x.name.localeCompare(y.name)));
    setNome("");
    setCriando(false);
    await colocar((data as Etiqueta).id);
  }

  async function apagarDoCatalogo(et: Etiqueta) {
    if (!window.confirm(`Apagar a etiqueta "${et.name}" de TODAS as tarefas? Não dá pra desfazer.`)) return;
    const { data, error } = await supabase.from("task_labels").delete().eq("id", et.id).select("id");
    if (error || !data || data.length === 0) {
      return setErro("Só quem criou a etiqueta (ou a liderança) pode apagar.");
    }
    setCatalogo((a) => a.filter((c) => c.id !== et.id));
    setLigadas((a) => a.filter((x) => x !== et.id));
    setErro(null);
    aoMudar();
  }

  const daTarefa = ligadas.map((id) => catalogo.find((c) => c.id === id)).filter((c): c is Etiqueta => !!c);
  const disponiveis = catalogo.filter((c) => !ligadas.includes(c.id));

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-muted">Etiquetas</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {daTarefa.map((et) => (
          <EtiquetaSelo key={et.id} etiqueta={et} aoTirar={() => tirar(et.id)} />
        ))}
        {!carregando && daTarefa.length === 0 && <span className="text-xs text-ink-muted">Nenhuma etiqueta.</span>}
        {disponiveis.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && colocar(e.target.value)}
            aria-label="Pôr uma etiqueta que já existe"
            className={`${campo} max-w-[10rem]`}
          >
            <option value="">+ Etiqueta</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setCriando((a) => !a)}
          className="text-xs font-medium text-brand-forte hover:underline"
        >
          {criando ? "Cancelar" : "Nova etiqueta"}
        </button>
        {catalogo.length > 0 && (
          <button
            type="button"
            onClick={() => setGerenciando((a) => !a)}
            className="text-xs text-ink-muted hover:text-ink hover:underline"
          >
            {gerenciando ? "Fechar" : "Gerenciar"}
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={criar} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas p-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={30}
            placeholder="Nome da etiqueta"
            aria-label="Nome da nova etiqueta"
            autoFocus
            className={`${campo} w-40`}
          />
          <div className="flex max-w-[16rem] flex-wrap items-center gap-1.5" role="group" aria-label="Cor da etiqueta">
            {CORES_TAREFA.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.nome}
                onClick={() => setCor(c.key)}
                style={{ backgroundColor: c.fundo }}
                className={`h-4 w-4 rounded-full ${cor === c.key ? "ring-2 ring-brand ring-offset-1 ring-offset-surface" : ""}`}
              />
            ))}
          </div>
          <button type="submit" disabled={!nome.trim()} className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-navy hover:bg-brand-hover disabled:opacity-50">
            Criar e colocar
          </button>
        </form>
      )}

      {gerenciando && (
        <ul className="mt-2 space-y-1 rounded-lg border border-line bg-canvas p-2">
          {catalogo.map((et) => (
            <li key={et.id} className="flex items-center justify-between gap-2">
              <EtiquetaSelo etiqueta={et} />
              <button
                type="button"
                onClick={() => apagarDoCatalogo(et)}
                className="text-[11px] text-ink-muted hover:text-danger hover:underline"
              >
                Apagar de todas as tarefas
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
    </div>
  );
}
