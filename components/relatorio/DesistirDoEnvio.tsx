"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trash2Icon } from "@/components/ui/icons";

// Apaga um envio que ainda não foi analisado (a RLS só deixa enquanto está
// pendente). Se o faturamento analisou nesse meio-tempo, nada é apagado e a
// lista se atualiza.
export default function DesistirDoEnvio({ id, nome }: { id: string; nome: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function desistir() {
    if (!window.confirm(`Desistir do envio de "${nome}"? Ele some da lista do faturamento.`)) return;
    setOcupado(true);
    const { error } = await supabase.from("service_submissions").delete().eq("id", id).eq("status", "pending");
    setOcupado(false);
    if (error) window.alert("Não foi possível apagar o envio. Tenta de novo.");
    router.refresh();
  }

  return (
    <button
      onClick={desistir}
      disabled={ocupado}
      title="Desistir do envio"
      aria-label={`Desistir do envio de ${nome}`}
      className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger disabled:opacity-40"
    >
      <Trash2Icon className="h-3.5 w-3.5" />
    </button>
  );
}
