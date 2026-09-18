"use client";

import { AlertTriangleIcon, ChevronRightIcon } from "../ui/icons";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import { invoiceDisplayStatus } from "@/lib/invoices";
import { irParaAba } from "./client-tab-switch";
import type { PublicInvoice } from "@/lib/types";

// "Precisa da sua atenção" — o mockup original pedia pendências como
// "enviar documento de identificação" ou "aprovar proposta comercial",
// mas o sistema não tem esse tipo de solicitação-com-prazo cadastrada em
// lugar nenhum. O dado real mais próximo disso são as faturas em aberto
// (principalmente as vencidas) — por isso o card usa faturas, não texto
// inventado. Some da tela quando não há nada pendente.
export function PendingInvoicesCard({ invoices }: { invoices: PublicInvoice[] }) {
  const pendentes = invoices
    .filter((f) => f.status === "pending")
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  if (pendentes.length === 0) return null;

  return (
    <div className="h-full rounded-2xl border border-warning/25 bg-warning-light/40 p-5 sm:p-6">
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-ink">Precisa da sua atenção</p>
          <p className="text-xs text-ink-muted">
            {pendentes.length} {pendentes.length === 1 ? "item pendente" : "itens pendentes"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {pendentes.slice(0, 3).map((fatura) => {
          const status = invoiceDisplayStatus(fatura);
          return (
            <div key={fatura.id} className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-ink">{fatura.description}</p>
              <span
                className={`flex-shrink-0 text-xs font-medium ${
                  status === "overdue" ? "text-danger" : "text-ink-muted"
                }`}
              >
                {status === "overdue" ? "Venceu em " : "Vence em "}
                {formatarDataBR(fatura.due_date)} · {formatarMoeda(fatura.amount)}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => irParaAba("faturas")}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        Ver todas as faturas
        <ChevronRightIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
