import type { FaturaAvancada, ItemDaFatura } from "@/lib/faturamento-avancado";
import type { PublicInvoice } from "@/lib/types";
import type { DadosDoPdf } from "./fatura-pdf";

// Converte a fatura que a função get_project_invoices devolve ao portal nos
// dados que o PDF espera.
export function dadosDoPdfDoPortal(f: PublicInvoice, nomeDoCliente: string): DadosDoPdf {
  const fatura: FaturaAvancada = {
    id: f.id,
    project_id: "",
    number: f.number ?? null,
    description: f.description,
    amount: Number(f.amount),
    due_date: f.due_date,
    status: f.status,
    paid_at: f.paid_at,
    items: (f.items ?? null) as ItemDaFatura[] | null,
    discount: Number(f.discount ?? 0),
    tax_percent: Number(f.tax_percent ?? 0),
    tax_label: f.tax_label ?? null,
    tax_added: f.tax_added ?? false,
    notes: f.notes ?? null,
    created_by_label: null,
    created_at: f.created_at ?? new Date().toISOString(),
  };
  return {
    fatura,
    parcelas: (f.installments ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
    emissor: f.issuer ? { ...f.issuer, default_notes: null } : null,
    cliente: f.client ?? null,
    nomeDoCliente,
  };
}
