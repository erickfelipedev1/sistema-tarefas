"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avisarServicoRevisado } from "@/lib/actions/push";
import type { Servico } from "@/lib/faturamento";
import { Button } from "@/components/ui/Button";
import { escreverValor, lerValor } from "./valor";

export interface TarefaSemValor {
  id: string;
  titulo: string;
  dia: string; // DD/MM da conclusão
  pessoas: string; // nomes dos responsáveis
  // Quando um colaborador já enviou essa tarefa dizendo qual serviço é.
  sugestao: { envioId: string; servicoId: string | null; pessoaNome: string } | null;
}

const VALOR_MAXIMO = 9999999.99;
const SEM_SERVICO = "";

// Tarefas que o cliente teve concluídas no mês e ainda não têm valor (aba
// Faturamento). Entram sozinhas na lista; quem cuida do faturamento põe o
// preço — e aí viram lançamento, pela função lancar_tarefa_no_faturamento
// (migration 0048) — ou marca "não cobrar". Não entram no total nem na fatura
// enquanto estão aqui, e não saem na impressão.
export default function TarefasSemValor({
  tarefas,
  dispensadas,
  servicos,
}: {
  tarefas: TarefaSemValor[];
  dispensadas: { id: string; titulo: string }[];
  servicos: Servico[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function dispensarTodas() {
    if (!window.confirm(`Marcar as ${tarefas.length} tarefas sem valor deste cliente como "não cobrar"?`)) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.rpc("dispensar_tarefas_do_faturamento", {
      p_task_ids: tarefas.map((t) => t.id),
      p_motivo: null,
    });
    setOcupado(false);
    if (error) return setErro("Não foi possível marcar as tarefas. Tenta de novo.");
    tarefas.forEach((t) => t.sugestao && avisarServicoRevisado(t.sugestao.envioId).catch(() => {}));
    router.refresh();
  }

  async function voltar(id: string) {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.from("service_task_skips").delete().eq("task_id", id);
    setOcupado(false);
    if (error) return setErro("Não foi possível voltar a tarefa pra lista. Tenta de novo.");
    router.refresh();
  }

  return (
    <div className="nao-imprime mt-3 border-t border-line pt-3">
      {tarefas.length > 0 && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-ink">
              Tarefas concluídas sem valor <span className="font-normal text-ink-muted">({tarefas.length})</span>
            </p>
            {tarefas.length > 1 && (
              <button
                onClick={dispensarTodas}
                disabled={ocupado}
                className="rounded-md px-1.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink disabled:opacity-40"
              >
                Não cobrar nenhuma
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            Ainda não contam no total. Ponha o valor pra incluir no relatório, ou marque como não cobrar.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {tarefas.map((t) => (
              <Linha key={t.id} tarefa={t} servicos={servicos} />
            ))}
          </ul>
        </>
      )}

      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}

      {dispensadas.length > 0 && (
        <details className={tarefas.length > 0 ? "mt-3" : ""}>
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
            {dispensadas.length} {dispensadas.length === 1 ? "tarefa marcada" : "tarefas marcadas"} como não cobrar
          </summary>
          <ul className="mt-1.5 space-y-1">
            {dispensadas.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="min-w-0 truncate">{d.titulo}</span>
                <button
                  onClick={() => voltar(d.id)}
                  disabled={ocupado}
                  className="flex-shrink-0 rounded-md px-1.5 py-0.5 font-medium text-brand-forte hover:underline disabled:opacity-40"
                >
                  Voltar pra lista
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Linha({ tarefa, servicos }: { tarefa: TarefaSemValor; servicos: Servico[] }) {
  const supabase = createClient();
  const router = useRouter();
  const sugerido = servicos.find((s) => s.id === tarefa.sugestao?.servicoId);
  const [servico, setServico] = useState(sugerido?.id ?? SEM_SERVICO);
  const [valor, setValor] = useState(sugerido ? escreverValor(sugerido.price) : "");
  const [ocupado, setOcupado] = useState<"incluir" | "dispensar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function escolher(id: string) {
    setServico(id);
    const doCatalogo = servicos.find((s) => s.id === id);
    if (doCatalogo) setValor(escreverValor(doCatalogo.price));
  }

  async function incluir() {
    const preco = lerValor(valor);
    if (preco === null || preco <= 0) {
      return setErro('Informa um valor maior que zero. Se não é pra cobrar, use "Não cobrar".');
    }
    if (preco > VALOR_MAXIMO) return setErro("Esse valor está alto demais; confere o que foi digitado.");
    setOcupado("incluir");
    setErro(null);
    const { error } = await supabase.rpc("lancar_tarefa_no_faturamento", {
      p_task_id: tarefa.id,
      p_service_id: servico || null,
      p_preco: preco,
    });
    setOcupado(null);
    if (error) {
      const mensagem = error.message ?? "";
      const mudou = mensagem.includes("já está no faturamento") || mensagem.includes("não está mais concluída");
      // 40P01: outra pessoa mexeu na mesma tarefa no mesmo instante.
      if (mudou) router.refresh();
      return setErro(
        mudou
          ? "Esta tarefa mudou desde que a tela abriu (já foi incluída ou reaberta). A lista foi atualizada."
          : "Não foi possível incluir. Tenta de novo."
      );
    }
    if (tarefa.sugestao) avisarServicoRevisado(tarefa.sugestao.envioId).catch(() => {});
    router.refresh();
  }

  async function dispensar() {
    let motivo: string | null = null;
    if (tarefa.sugestao) {
      motivo = window.prompt(
        `${tarefa.sugestao.pessoaNome} enviou esta tarefa pro faturamento. Por que não vai ser cobrada? (ele lê o motivo)`
      );
      if (motivo === null) return;
    }
    setOcupado("dispensar");
    setErro(null);
    const { error } = await supabase.rpc("dispensar_tarefas_do_faturamento", {
      p_task_ids: [tarefa.id],
      p_motivo: motivo,
    });
    setOcupado(null);
    if (error) return setErro("Não foi possível marcar como não cobrar. Tenta de novo.");
    if (tarefa.sugestao) avisarServicoRevisado(tarefa.sugestao.envioId).catch(() => {});
    router.refresh();
  }

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{tarefa.titulo}</p>
          <p className="text-xs text-ink-muted">
            Concluída em {tarefa.dia}
            {tarefa.pessoas && ` · ${tarefa.pessoas}`}
            {tarefa.sugestao && ` · enviada por ${tarefa.sugestao.pessoaNome}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={servico}
            onChange={(e) => escolher(e.target.value)}
            aria-label={`Serviço de ${tarefa.titulo}`}
            className="max-w-[190px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value={SEM_SERVICO}>Usar o nome da tarefa</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (R$)"
            inputMode="decimal"
            aria-label={`Valor de ${tarefa.titulo}`}
            className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-right text-sm text-ink focus:border-brand focus:outline-none"
          />
          <Button variant="ghost" size="sm" onClick={dispensar} disabled={ocupado !== null}>
            {ocupado === "dispensar" ? "Marcando..." : "Não cobrar"}
          </Button>
          <Button size="sm" onClick={incluir} disabled={ocupado !== null}>
            {ocupado === "incluir" ? "Incluindo..." : "Incluir"}
          </Button>
        </div>
      </div>
      {erro && <p className="mt-1 text-right text-xs text-danger">{erro}</p>}
    </li>
  );
}
