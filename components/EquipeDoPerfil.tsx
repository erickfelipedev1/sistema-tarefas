"use client";

import { useState } from "react";
import { salvarFuncaoDaPessoa } from "@/lib/actions/equipe";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { PencilIcon } from "./ui/icons";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
  avatar: string | null;
  cargo: string;
  descricao: string;
}

const campo =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Seção "Equipe" do Meu perfil: a função e a descrição de cada pessoa. Todo
// mundo vê; a liderança edita (pelo servidor, lib/actions/equipe.ts).
export default function EquipeDoPerfil({ pessoas, podeEditar }: { pessoas: PessoaDaEquipe[]; podeEditar: boolean }) {
  const [lista, setLista] = useState(pessoas);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ cargo: "", descricao: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(id: string) {
    setSalvando(true);
    setErro(null);
    const r = await salvarFuncaoDaPessoa(id, rascunho.cargo, rascunho.descricao);
    setSalvando(false);
    if ("erro" in r) return setErro(r.erro);
    setLista((atual) => atual.map((p) => (p.id === id ? { ...p, cargo: rascunho.cargo.trim(), descricao: rascunho.descricao.trim() } : p)));
    setEditando(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-semibold text-ink">Equipe</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        A função e o que cada pessoa faz{podeEditar ? ". Como liderança, você pode editar de todo mundo." : "."}
      </p>
      <ul className="mt-4 divide-y divide-line">
        {lista.map((p) => (
          <li key={p.id} className="py-3">
            {editando === p.id ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">{p.nome}</p>
                <input
                  value={rascunho.cargo}
                  onChange={(e) => setRascunho((r) => ({ ...r, cargo: e.target.value.slice(0, 60) }))}
                  placeholder="Função (ex: Designer, Gestor de tráfego)"
                  aria-label={`Função de ${p.nome}`}
                  className={campo}
                />
                <textarea
                  value={rascunho.descricao}
                  onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value.slice(0, 500) }))}
                  rows={3}
                  placeholder="O que essa pessoa faz, pelo que responde, quando procurar ela..."
                  aria-label={`Descrição de ${p.nome}`}
                  className={campo}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" type="button" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" type="button" disabled={salvando} onClick={() => salvar(p.id)}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Avatar name={p.nome} src={p.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {p.nome}
                    {p.cargo && <span className="ml-1.5 font-normal text-ink-muted">· {p.cargo}</span>}
                  </p>
                  {p.descricao ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-ink-muted">{p.descricao}</p>
                  ) : (
                    <p className="mt-0.5 text-xs italic text-ink-muted">Sem descrição.</p>
                  )}
                </div>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => {
                      setRascunho({ cargo: p.cargo, descricao: p.descricao });
                      setEditando(p.id);
                      setErro(null);
                    }}
                    aria-label={`Editar ${p.nome}`}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
    </div>
  );
}
