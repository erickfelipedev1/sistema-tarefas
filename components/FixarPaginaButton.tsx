"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PinIcon } from "./ui/icons";

// Fixa (ou solta) uma página da Wiki do cliente em destaque: grava
// pages.pinned_at (migration 0054). O destaque é do cliente, não de quem
// clicou — todo mundo que abre a aba vê a página no topo.
export default function FixarPaginaButton({ pageId, fixada }: { pageId: string; fixada: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    const { error } = await supabase
      .from("pages")
      .update({ pinned_at: fixada ? null : new Date().toISOString() })
      .eq("id", pageId);
    setOcupado(false);
    if (error) {
      window.alert(
        "Não deu pra fixar a página. Confere se a migration 0054_wiki_fixada.sql já foi rodada no Supabase."
      );
      return;
    }
    router.refresh();
  }

  const rotulo = fixada ? "Tirar do destaque" : "Fixar em destaque";
  return (
    <button
      onClick={alternar}
      disabled={ocupado}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={fixada}
      className={`rounded-md p-1 transition-colors hover:bg-surface-hover disabled:opacity-50 ${
        fixada ? "text-brand-forte" : "text-ink-muted hover:text-ink"
      }`}
    >
      <PinIcon className="h-3.5 w-3.5" fill={fixada ? "currentColor" : "none"} />
    </button>
  );
}
