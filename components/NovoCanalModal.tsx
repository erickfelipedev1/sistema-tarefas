"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { XIcon } from "@/components/ui/icons";
import { useChatUI } from "./ChatUIContext";

// Só o campo "Nome do canal" é real — Descrição, Empresa/Projeto e
// Privacidade ficaram de fora porque a tabela "channels" não tem essas
// colunas hoje (combinado com o Erick: sem migração neste momento).
export default function NovoCanalModal() {
  const { novoCanalAberto, fechar } = useChatUI();
  const router = useRouter();
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!novoCanalAberto) return null;

  function fecharModal() {
    setNome("");
    setErro(null);
    fechar();
  }

  async function criarCanal(e: React.FormEvent) {
    e.preventDefault();
    const slug = nome.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) {
      setErro("Dá um nome pro canal.");
      return;
    }

    setCriando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("channels")
      .insert({ name: slug })
      .select()
      .single();
    setCriando(false);

    if (error || !data) {
      setErro(
        error?.code === "23505"
          ? "Já existe um canal com esse nome."
          : "Não foi possível criar o canal. Tenta de novo."
      );
      return;
    }

    fecharModal();
    router.push(`/chat/canal/${data.id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-chat-surface p-5 shadow-dropdown">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Novo canal</h2>
          <button
            onClick={fecharModal}
            aria-label="Fechar"
            className="rounded-md p-1 text-chat-muted hover:bg-chat-surface-hover hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={criarCanal} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-chat-muted">
              Nome do canal
            </label>
            <div className="flex items-center rounded-lg border border-chat-border bg-chat-bg px-3 focus-within:border-brand">
              <span className="text-sm text-chat-muted">#</span>
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="marketing"
                className="h-10 w-full bg-transparent px-1 text-sm text-white placeholder-chat-muted focus:outline-none"
              />
            </div>
            {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fecharModal}
              className="text-chat-muted hover:bg-chat-surface-hover hover:text-white"
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
