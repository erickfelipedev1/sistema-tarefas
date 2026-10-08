"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceItem } from "@/lib/types";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import { nomeDoMes } from "@/lib/relatorio";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface FaturaDoMes {
  id: string;
  amount: number;
  due_date: string;
  status: string; // pending | paid | cancelled
  items: InvoiceItem[] | null;
}

// O jsonb do Postgres devolve as chaves em outra ordem, então comparar os
// itens com JSON.stringify daria sempre "mudou". Compara campo a campo.
function assinatura(itens: InvoiceItem[] | null) {
  return (itens ?? [])
    .map((i) =>
      [i.name, i.detail ?? "", Number(i.quantity), Number(i.unit_price), Number(i.total), !!i.recurring].join("|")
    )
    .join("\n");
}

// "YYYY-MM-DD" daqui a n dias, no fuso de quem está usando.
function daquiA(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fecha o mês de um cliente: transforma o que está no relatório numa fatura
// na aba "Faturas" dele (tabela invoices, migration 0045), que é a lista que
// o cliente vê no portal. Uma fatura por cliente e mês — se o relatório mudar
// depois do envio, o botão vira "Atualizar fatura" e corrige a mesma. Não sai
// na impressão.
export default function EnviarAoCliente({
  projectId,
  clienteNome,
  mes,
  total,
  itens,
  fatura,
  usuarioRotulo,
  tarefasSemValor,
}: {
  projectId: string;
  clienteNome: string;
  mes: string;
  total: number;
  itens: InvoiceItem[];
  fatura: FaturaDoMes | null;
  usuarioRotulo: string;
  // Tarefas concluídas do cliente que ainda não têm valor: ficam fora da fatura.
  tarefasSemValor: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [vencimento, setVencimento] = useState(() => daquiA(7));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!vencimento) return setErro("Escolhe a data de vencimento.");
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.from("invoices").insert({
      project_id: projectId,
      description: `Serviços de ${nomeDoMes(mes)}`,
      amount: total,
      due_date: vencimento,
      billing_month: `${mes}-01`,
      items: itens,
      created_by_label: usuarioRotulo,
    });
    setOcupado(false);
    if (error) {
      // 23505: outra pessoa (ou outra aba) acabou de enviar o mesmo mês.
      setErro(
        error.code === "23505"
          ? "Este mês já foi enviado pra este cliente. Recarregue a página."
          : "Não foi possível enviar. Tenta de novo."
      );
      return;
    }
    setAberto(false);
    router.refresh();
  }

  async function atualizar() {
    if (!fatura) return;
    const aviso =
      fatura.status === "cancelled"
        ? `A fatura de ${clienteNome} estava cancelada. Reabrir com ${formatarMoeda(total)}?`
        : `Atualizar a fatura de ${clienteNome} de ${formatarMoeda(fatura.amount)} para ${formatarMoeda(total)}? O cliente passa a ver o valor novo.`;
    if (!window.confirm(aviso)) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase
      .from("invoices")
      .update({
        amount: total,
        items: itens,
        ...(fatura.status === "cancelled" ? { status: "pending", paid_at: null } : {}),
      })
      .eq("id", fatura.id);
    setOcupado(false);
    if (error) return setErro("Não foi possível atualizar a fatura. Tenta de novo.");
    router.refresh();
  }

  if (fatura) {
    const mudou =
      Math.abs(fatura.amount - total) >= 0.005 || assinatura(fatura.items) !== assinatura(itens);
    const paga = fatura.status === "paid";
    const cancelada = fatura.status === "cancelled";
    return (
      <div className="nao-imprime mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-xs text-ink-muted">
        <Badge tone={paga ? "success" : cancelada ? "neutral" : "brand"}>
          {paga ? "Fatura paga" : cancelada ? "Fatura cancelada" : "Enviado ao cliente"}
        </Badge>
        <span>
          Fatura de {formatarMoeda(fatura.amount)}, vence em {formatarDataBR(fatura.due_date)}
        </span>
        {mudou && !paga && (
          <span className="font-medium text-warning">
            O relatório mudou depois do envio e agora soma {formatarMoeda(total)}.
          </span>
        )}
        {(mudou || cancelada) && !paga && (
          <Button variant="secondary" size="sm" onClick={atualizar} disabled={ocupado || total <= 0}>
            {ocupado ? "Atualizando..." : cancelada ? "Reabrir fatura" : "Atualizar fatura"}
          </Button>
        )}
        {mudou && paga && (
          <span className="font-medium text-warning">
            O relatório agora soma {formatarMoeda(total)}, mas a fatura já foi paga: ajuste pela aba Faturas do
            cliente.
          </span>
        )}
        {erro && <span className="text-danger">{erro}</span>}
      </div>
    );
  }

  if (total <= 0) return null;

  return (
    <div className="nao-imprime mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-3">
      {aberto ? (
        <>
          <p className="mr-auto text-xs text-ink-muted">
            Cria a fatura &quot;Serviços de {nomeDoMes(mes)}&quot;, de {formatarMoeda(total)}, na aba Faturas de{" "}
            {clienteNome}. O cliente vê no portal dele.
            {tarefasSemValor > 0 && (
              <span className="mt-1 block font-medium text-warning">
                {tarefasSemValor === 1
                  ? "Há 1 tarefa concluída sem valor: ela fica fora desta fatura."
                  : `Há ${tarefasSemValor} tarefas concluídas sem valor: elas ficam fora desta fatura.`}
              </span>
            )}
          </p>
          {erro && <p className="w-full text-right text-xs text-danger">{erro}</p>}
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            Vencimento
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={enviar} disabled={ocupado}>
            {ocupado ? "Enviando..." : "Confirmar envio"}
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setAberto(true)}>
          Enviar para o cliente
        </Button>
      )}
    </div>
  );
}
