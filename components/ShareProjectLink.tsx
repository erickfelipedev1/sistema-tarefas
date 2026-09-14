"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Link público (sem precisar de login) que mostra o progresso do projeto
// pro cliente — "Gerar novo link" invalida o antigo na hora.
export default function ShareProjectLink({
  projectId,
  shareToken,
}: {
  projectId: string;
  shareToken: string;
}) {
  const supabase = createClient();
  const [token, setToken] = useState(shareToken);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/progresso/${token}`
      : `/progresso/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia o link:", link);
    }
  }

  async function gerarNovoLink() {
    const ok = window.confirm(
      "Gerar um novo link? O link antigo para de funcionar na hora."
    );
    if (!ok) return;
    setGerando(true);
    const { data, error } = await supabase
      .from("projects")
      .update({ share_token: crypto.randomUUID() })
      .eq("id", projectId)
      .select("share_token")
      .single();
    setGerando(false);
    if (!error && data) {
      setToken(data.share_token);
    } else {
      window.alert(
        "Não deu pra gerar um novo link. Confere se a migration 0018_project_progress_share.sql já foi rodada no Supabase."
      );
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm text-slate-500">
        📊 Link de progresso pro cliente:
      </span>
      <code className="min-w-[200px] flex-1 truncate rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
        {link}
      </code>
      <button
        onClick={copiar}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
      <button
        onClick={gerarNovoLink}
        disabled={gerando}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
      >
        {gerando ? "Gerando..." : "Gerar novo link"}
      </button>
    </div>
  );
}
