"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { UsersIcon, XIcon } from "@/components/ui/icons";

export type PessoaDoCanal = { id: string; nome: string; ativo: boolean };

// Quem faz parte de um canal privado: só quem criou o canal refaz a lista (a
// regra está na função definir_membros_do_canal, migration 0111). Quem criou
// nunca sai da lista.
export default function MembrosDoCanal({
  channelId,
  pessoas,
  membrosIds,
  criadorId,
}: {
  channelId: string;
  pessoas: PessoaDoCanal[];
  membrosIds: string[];
  criadorId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>(membrosIds);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem já é membro aparece mesmo se ficou inativo (senão sairia sem querer ao salvar).
  const lista = useMemo(
    () =>
      pessoas
        .filter((p) => p.ativo || membrosIds.includes(p.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pessoas, membrosIds]
  );
  const visiveis = lista.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  function abrir() {
    setEscolhidos(membrosIds);
    setBusca("");
    setErro(null);
    setAberto(true);
  }

  function alternar(id: string) {
    if (id === criadorId) return;
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.rpc("definir_membros_do_canal", { p_canal: channelId, p_membros: escolhidos });
    setSalvando(false);
    if (error) {
      setErro(
        /Escolha pelo menos/i.test(error.message)
          ? "Escolha pelo menos uma pessoa além de você."
          : /Só quem criou/i.test(error.message)
            ? "Só quem criou o canal muda os membros."
            : "Não deu pra salvar os membros. Tente de novo."
      );
      return;
    }
    setAberto(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Membros do canal"
        title="Membros do canal"
        className="flex-shrink-0 rounded-lg p-2 text-ink-muted hover:bg-surface-hover hover:text-ink"
      >
        <UsersIcon className="h-[18px] w-[18px]" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div role="dialog" aria-modal="true" aria-label="Membros do canal" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-surface p-5 shadow-dropdown">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Membros do canal</h2>
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
              Só quem está marcado vê o canal e as mensagens. Quem sai deixa de ver o canal na hora.
            </p>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa"
              aria-label="Buscar pessoa"
              className="mb-2 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
            <ul className="max-h-60 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
              {visiveis.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-hover">
                    <input
                      type="checkbox"
                      checked={escolhidos.includes(p.id)}
                      disabled={p.id === criadorId}
                      onChange={() => alternar(p.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    {p.nome}
                    {p.id === criadorId && <span className="text-xs text-ink-muted">(criou o canal)</span>}
                  </label>
                </li>
              ))}
              {visiveis.length === 0 && <li className="px-2 py-1.5 text-xs text-ink-muted">Ninguém encontrado.</li>}
            </ul>
            {erro && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {erro}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)} className="text-ink-muted hover:bg-surface-hover hover:text-ink">
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
