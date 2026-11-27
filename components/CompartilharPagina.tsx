"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { UsersIcon, XIcon } from "@/components/ui/icons";

type Acesso = "editar" | "ler";
type Pessoa = { id: string; nome: string; ativo: boolean };

// Compartilhar uma página pessoal da Wiki (migration 0133): quem criou escolhe
// as pessoas e, pra cada uma, "pode editar" ou "só ver". Quem entra é avisado
// no sininho; quem sai perde o acesso na hora. A regra mora na função
// compartilhar_pagina do banco.
export default function CompartilharPagina({
  pageId,
  euId,
  quantasInicial = 0,
}: {
  pageId: string;
  euId: string;
  quantasInicial?: number;
}) {
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [acessos, setAcessos] = useState<Record<string, Acesso>>({});
  const [iniciais, setIniciais] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quantas, setQuantas] = useState<number>(quantasInicial);

  async function abrir() {
    setAberto(true);
    setBusca("");
    setErro(null);
    setAviso(null);
    setCarregando(true);
    const [{ data: perfis, error: e1 }, { data: atuais, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("id, name, username, ativo"),
      supabase.from("pages_compartilhadas").select("profile_id, pode_editar").eq("page_id", pageId),
    ]);
    setCarregando(false);
    if (e1 || e2) return setErro("Não deu pra carregar quem tem acesso. Tente de novo.");
    const mapa: Record<string, Acesso> = {};
    for (const c of atuais ?? []) mapa[c.profile_id as string] = c.pode_editar ? "editar" : "ler";
    setAcessos(mapa);
    setIniciais(Object.keys(mapa));
    setQuantas(Object.keys(mapa).length);
    setPessoas(
      (perfis ?? [])
        .filter((p) => p.id !== euId)
        .map((p) => ({ id: p.id as string, nome: ((p.name as string) || (p.username as string) || "Sem nome").trim(), ativo: p.ativo !== false }))
    );
  }

  // Quem já tem acesso aparece mesmo se ficou inativo (senão sairia sem querer ao salvar).
  const lista = useMemo(
    () =>
      pessoas
        .filter((p) => p.ativo || iniciais.includes(p.id))
        .sort((a, b) => {
          const ta = a.id in acessos ? 0 : 1;
          const tb = b.id in acessos ? 0 : 1;
          return ta - tb || a.nome.localeCompare(b.nome, "pt-BR");
        }),
    // A ordem só muda ao abrir (não pula enquanto marca).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pessoas, iniciais]
  );
  const visiveis = lista.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  function alternar(id: string) {
    setAcessos((atual) => {
      const novo = { ...atual };
      if (id in novo) delete novo[id];
      else novo[id] = "editar";
      return novo;
    });
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const editam = Object.keys(acessos).filter((id) => acessos[id] === "editar");
    const leem = Object.keys(acessos).filter((id) => acessos[id] === "ler");
    const { error } = await supabase.rpc("compartilhar_pagina", { p_page: pageId, p_editam: editam, p_leem: leem });
    setSalvando(false);
    if (error) {
      setErro(/Só quem criou/i.test(error.message) ? "Só quem criou a página escolhe com quem compartilhar." : "Não deu pra salvar. Tente de novo.");
      return;
    }
    const novas = Object.keys(acessos).filter((id) => !iniciais.includes(id)).length;
    setQuantas(editam.length + leem.length);
    setAberto(false);
    setAviso(novas > 0 ? `Compartilhada. ${novas === 1 ? "A pessoa foi avisada" : "As pessoas foram avisadas"} no sininho.` : "Acesso atualizado.");
    setTimeout(() => setAviso(null), 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-medium text-ink hover:bg-surface-hover"
      >
        <UsersIcon className="h-3.5 w-3.5" />
        Compartilhar{quantas ? ` (${quantas})` : ""}
      </button>
      {aviso && <span className="text-success">{aviso}</span>}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Compartilhar página"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-5 shadow-dropdown"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Compartilhar página</h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-ink-muted">
              Quem você marcar vê a página na Wiki, em &quot;Compartilhadas comigo&quot;, e é avisado no sininho. Sem marcar, só
              você vê.
            </p>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa"
              aria-label="Buscar pessoa"
              className="mb-2 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
            {carregando ? (
              <p className="py-4 text-center text-xs text-ink-muted">Carregando...</p>
            ) : (
              <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
                {visiveis.map((p) => {
                  const acesso = acessos[p.id];
                  return (
                    <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-hover">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={!!acesso}
                          onChange={() => alternar(p.id)}
                          className="h-4 w-4 flex-shrink-0 accent-brand"
                        />
                        <span className="truncate">{p.nome}</span>
                      </label>
                      {acesso && (
                        <select
                          value={acesso}
                          onChange={(e) => setAcessos((atual) => ({ ...atual, [p.id]: e.target.value as Acesso }))}
                          aria-label={`Acesso de ${p.nome}`}
                          className="h-7 flex-shrink-0 rounded-md border border-line bg-canvas px-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                        >
                          <option value="editar">Pode editar</option>
                          <option value="ler">Só ver</option>
                        </select>
                      )}
                    </li>
                  );
                })}
                {visiveis.length === 0 && <li className="px-2 py-1.5 text-xs text-ink-muted">Ninguém encontrado.</li>}
              </ul>
            )}
            {erro && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {erro}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAberto(false)}
                className="text-ink-muted hover:bg-surface-hover hover:text-ink"
              >
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={salvar} disabled={salvando || carregando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
