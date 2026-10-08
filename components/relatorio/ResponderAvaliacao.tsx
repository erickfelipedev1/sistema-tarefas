"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// Resposta do colaborador a uma avaliação que recebeu. Grava pela função
// responder_avaliacao (migration 0046), que só mexe na resposta — a pessoa
// não tem como alterar nota nem texto de quem avaliou. Só ela e quem avalia
// leem.
export default function ResponderAvaliacao({ id, inicial }: { id: string; inicial: string }) {
  const supabase = createClient();
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = texto.trim() !== salvo.trim();

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.rpc("responder_avaliacao", { p_id: id, p_resposta: texto });
    setSalvando(false);
    if (error) return setErro("Não foi possível enviar a resposta. Tenta de novo.");
    setSalvo(texto);
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-ink">Sua resposta</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Se quiser, comente a avaliação: o que concorda, o que vê diferente, do que precisa pra melhorar."
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </label>
      <div className="mt-2 flex items-center justify-end gap-3">
        {erro && <p className="text-sm text-danger">{erro}</p>}
        {!erro && !mudou && salvo.trim() !== "" && <p className="text-xs text-ink-muted">Resposta enviada</p>}
        <Button size="sm" onClick={salvar} disabled={salvando || !mudou}>
          {salvando ? "Enviando..." : salvo.trim() ? "Atualizar resposta" : "Enviar resposta"}
        </Button>
      </div>
    </div>
  );
}
