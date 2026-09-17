import type { Invoice, InvoiceStatus, PublicInvoice } from "./types";

// "Vencida" não é um status gravado no banco — é calculado aqui (evita
// precisar de uma tarefa agendada só pra virar o status todo dia). Uma
// fatura "pending" cujo vencimento já passou aparece como vencida tanto
// pra equipe (InvoicesManager) quanto pro cliente (InvoicesPanel).
export type InvoiceDisplayStatus = "pending" | "overdue" | "paid" | "cancelled";

export function invoiceDisplayStatus(
  invoice: Pick<Invoice | PublicInvoice, "status" | "due_date">
): InvoiceDisplayStatus {
  if (invoice.status !== "pending") return invoice.status;
  const hoje = new Date().toISOString().slice(0, 10);
  return invoice.due_date < hoje ? "overdue" : "pending";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  pending: "Em aberto",
  overdue: "Vencida",
  paid: "Paga",
  cancelled: "Cancelada",
};

export const INVOICE_STATUS_TONE: Record<
  InvoiceDisplayStatus,
  "neutral" | "brand" | "success" | "warning" | "danger"
> = {
  pending: "brand",
  overdue: "danger",
  paid: "success",
  cancelled: "neutral",
};

export type { InvoiceStatus };
