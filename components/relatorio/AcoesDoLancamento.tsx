"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nomeDoMes, somarMes } from "@/lib/relatorio";
import { Trash2Icon } from "@/components/ui/icons";

// O que dá pra fazer com uma linha do faturamento. Avulso: excluir. Mensal:
// encerrar (este passa a ser o último mês cobrado), reativar, ou excluir de
// vez — o que apaga também dos meses anteriores, por isso a confirmação diz
// isso com todas as letras.
export default function AcoesDoLancamento({
  id,
  nome,
  mes,
  mensal,
  soExisteNesteMes,
  encerraNesteMes,
}: {
  id: string;
  nome: string;
  mes: string;
  mensal: boolean;
  // Avulso, ou mensal que começa e termina neste mês: excluir só mexe aqui.
  soExisteNesteMes: boolean;
  encerraNesteMes: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true);
    const { error } = await acao();
    setOcupado(false);
    if (error) {
      window.alert("Não foi possível concluir. Tenta de novo.");
      return;
    }
    router.refresh();
  }

  function excluir() {
    const aviso = soExisteNesteMes
      ? `Excluir "${nome}" deste relatório?`
      : `Excluir "${nome}" de TODOS os meses em que ele aparece, antes e depois deste? Pra só parar de cobrar daqui pra frente, use "Encerrar".`;
    if (!window.confirm(aviso)) return;
    executar(() => supabase.from("service_entries").delete().eq("id", id));
  }

  function encerrar() {
    const proximo = nomeDoMes(somarMes(mes, 1)).split(" de ")[0];
    if (!window.confirm(`Encerrar "${nome}"? ${nomeDoMes(mes)} será o último mês cobrado; a partir de ${proximo} ele não aparece mais.`)) return;
    executar(() => supabase.from("service_entries").update({ ended_month: `${mes}-01` }).eq("id", id));
  }

  function reativar() {
    executar(() => supabase.from("service_entries").update({ ended_month: null }).eq("id", id));
  }

  const botaoTexto =
    "rounded-md px-1.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink disabled:opacity-40";

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {mensal &&
        (encerraNesteMes ? (
          <button onClick={reativar} disabled={ocupado} className={botaoTexto}>
            Reativar
          </button>
        ) : (
          <button onClick={encerrar} disabled={ocupado} className={botaoTexto}>
            Encerrar
          </button>
        ))}
      <button
        onClick={excluir}
        disabled={ocupado}
        title="Excluir lançamento"
        aria-label={`Excluir ${nome}`}
        className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger disabled:opacity-40"
      >
        <Trash2Icon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
