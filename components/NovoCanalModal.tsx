"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { LockIcon, XIcon } from "@/components/ui/icons";
import { useChatUI } from "./ChatUIContext";

// Canal novo. Só o nome é obrigatório (canal aberto: toda a equipe vê). Marcando
// "Canal privado" dá pra escolher exatamente quem faz parte: só essas pessoas
// (e quem criou) veem o canal e as mensagens. A regra fica no banco (migrations
// 0035 e 0111): o canal privado nasce pela função criar_canal_privado.
export default function NovoCanalModal({ profiles }: { profiles: Profile[] }) {
  const { novoCanalAberto, fechar } = useChatUI();
  const router = useRouter();
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [privado, setPrivado] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só gente ativa, em ordem de nome (a lista já não traz quem está criando).
  const pessoas = useMemo(
    () =>
      profiles
        .filter((p) => p.ativo !== false)
        .map((p) => ({ id: p.id, nome: (p.name || p.username || "Sem nome").trim() }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [profiles]
  );
  const visiveis = pessoas.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  if (!novoCanalAberto) return null;

  function fecharModal() {
    setNome("");
    setPrivado(false);
    setEscolhidos([]);
    setBusca("");
    setErro(null);
    fechar();
  }

  function alternar(id: string) {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function criarCanal(e: React.FormEvent) {
    e.preventDefault();
    if (criando) return;
    const slug = nome.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) {
      setErro("Dá um nome pro canal.");
      return;
    }
    if (privado && escolhidos.length === 0) {
      setErro("Escolha pelo menos uma pessoa para o canal privado.");
      return;
    }

    setCriando(true);
    setErro(null);
    let id: string | null = null;
    let falha: { code?: string; message?: string } | null = null;
    if (privado) {
      const { data, error } = await supabase.rpc("criar_canal_privado", { p_nome: slug, p_membros: escolhidos });
      id = (data as string | null) ?? null;
      falha = error;
    } else {
      const { data, error } = await supabase.from("channels").insert({ name: slug }).select().single();
      id = (data?.id as string | undefined) ?? null;
      falha = error;
    }
    setCriando(false);

    if (falha || !id) {
      setErro(
        falha?.code === "23505"
          ? "Já existe um canal com esse nome."
          : privado && /criar_canal_privado/i.test(falha?.message ?? "")
            ? "Falta liberar os canais privados no banco (migration 0111)."
            : "Não foi possível criar o canal. Tenta de novo."
      );
      return;
    }

    fecharModal();
    router.push(`/chat/canal/${id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-surface p-5 shadow-dropdown">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Novo canal</h2>
          <button
            onClick={fecharModal}
            aria-label="Fechar"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={criarCanal} className="space-y-3">
          <div>
            <label htmlFor="novo-canal-nome" className="mb-1 block text-xs font-medium text-ink-muted">
              Nome do canal
            </label>
            <div className="flex items-center rounded-lg border border-line bg-canvas px-3 focus-within:border-brand">
              <span className="text-sm text-ink-muted">#</span>
              <input
                id="novo-canal-nome"
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={60}
                placeholder="marketing"
                className="h-10 w-full bg-transparent px-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2">
            <input
              type="checkbox"
              checked={privado}
              onChange={(e) => setPrivado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span className="text-sm text-ink">
              <span className="inline-flex items-center gap-1 font-medium">
                <LockIcon className="h-3.5 w-3.5" /> Canal privado
              </span>
              <span className="block text-xs text-ink-muted">
                Só as pessoas que você escolher veem o canal e as mensagens. Sem isso, toda a equipe vê.
              </span>
            </span>
          </label>

          {privado && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-ink-muted">
                Quem faz parte ({escolhidos.length} escolhida{escolhidos.length === 1 ? "" : "s"}, mais você)
              </legend>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pessoa"
                aria-label="Buscar pessoa"
                className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
              <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
                {visiveis.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={escolhidos.includes(p.id)}
                        onChange={() => alternar(p.id)}
                        className="h-4 w-4 accent-brand"
                      />
                      {p.nome}
                    </label>
                  </li>
                ))}
                {visiveis.length === 0 && <li className="px-2 py-1.5 text-xs text-ink-muted">Ninguém encontrado.</li>}
              </ul>
            </fieldset>
          )}

          {erro && (
            <p role="alert" className="text-xs text-danger">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fecharModal}
              className="text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={criando}>
              {criando ? "Criando..." : "Criar canal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
