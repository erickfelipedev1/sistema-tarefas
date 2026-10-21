"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carregarStatusDaPostagem, textoSobre, type StatusDaPostagem } from "@/lib/status-postagem";
import { PencilIcon, PlusIcon, Trash2Icon } from "../ui/icons";

// Escolha do status da postagem na tarefa (migration 0086): uma etiqueta por
// tarefa, e a cor dela vira a cor do post no Calendário de postagem. Quem
// gerencia (profiles.gerencia_status_postagem) também edita o catálogo aqui.
export default function StatusDaPostagemPicker({
  valor,
  aoMudar,
}: {
  valor: string | null;
  aoMudar: (id: string | null) => void;
}) {
  const supabase = createClient();
  const [lista, setLista] = useState<StatusDaPostagem[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [gerencia, setGerencia] = useState(false);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const esperas = useRef<Record<string, number>>({});

  async function recarregar() {
    setLista(await carregarStatusDaPostagem(supabase));
    setCarregou(true);
  }

  useEffect(() => {
    recarregar();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      setGerencia(p?.gerencia_status_postagem === true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(id: string, campos: Partial<Pick<StatusDaPostagem, "name" | "color">>) {
    setErro(null);
    const { error } = await supabase.from("post_status_labels").update(campos).eq("id", id);
    if (error) setErro(/duplicate|unique/i.test(error.message) ? "Já existe uma etiqueta com esse nome." : "Não deu pra salvar a etiqueta.");
    await recarregar();
  }

  async function criar() {
    setErro(null);
    const nome = `Nova etiqueta ${lista.length + 1}`;
    const { error } = await supabase
      .from("post_status_labels")
      .insert({ name: nome, color: "#7c8a5a", position: (lista.at(-1)?.position ?? 0) + 1 });
    if (error) setErro("Não deu pra criar a etiqueta.");
    await recarregar();
  }

  async function apagar(s: StatusDaPostagem) {
    if (!window.confirm(`Apagar a etiqueta "${s.name}"? As tarefas com ela ficam sem status.`)) return;
    setErro(null);
    const { error } = await supabase.from("post_status_labels").delete().eq("id", s.id);
    if (error) setErro("Não deu pra apagar a etiqueta.");
    if (valor === s.id) aoMudar(null);
    await recarregar();
  }

  if (carregou && lista.length === 0 && !gerencia) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">Status da postagem</p>
        {gerencia && (
          <button
            type="button"
            onClick={() => setEditando((e) => !e)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-forte hover:underline"
          >
            <PencilIcon className="h-3 w-3" />
            {editando ? "Pronto" : "Editar etiquetas"}
          </button>
        )}
      </div>

      {!editando ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {lista.map((s) => {
            const ativo = valor === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => aoMudar(ativo ? null : s.id)}
                title={ativo ? "Clique de novo pra tirar o status" : s.name}
                style={{ backgroundColor: s.color, color: textoSobre(s.color) }}
                className={`truncate rounded-md px-2 py-2 text-xs font-medium transition-transform active:scale-[0.98] ${
                  ativo ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : valor ? "opacity-55 hover:opacity-100" : ""
                }`}
              >
                {ativo ? "✓ " : ""}
                {s.name}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {lista.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <input
                type="color"
                defaultValue={s.color}
                onChange={(e) => {
                  // O seletor manda a cor a cada movimento: salva quando parar.
                  const cor = e.target.value;
                  window.clearTimeout(esperas.current[s.id]);
                  esperas.current[s.id] = window.setTimeout(() => {
                    if (cor.toLowerCase() !== s.color.toLowerCase()) salvar(s.id, { color: cor });
                  }, 600);
                }}
                aria-label={`Cor de ${s.name}`}
                className="h-8 w-10 flex-shrink-0 cursor-pointer rounded border border-line bg-surface"
              />
              <input
                defaultValue={s.name}
                maxLength={40}
                onBlur={(e) => {
                  const nome = e.target.value.trim();
                  if (nome && nome !== s.name) salvar(s.id, { name: nome });
                  else e.target.value = s.name;
                }}
                aria-label="Nome da etiqueta"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => apagar(s)}
                aria-label={`Apagar ${s.name}`}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-light hover:text-danger"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={criar}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Nova etiqueta
            </button>
          </li>
        </ul>
      )}
      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
      {!editando && (
        <p className="mt-1 text-[11px] text-ink-muted">A cor do status é a cor do post no Calendário de postagem.</p>
      )}
    </div>
  );
}
