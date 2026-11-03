import { Badge } from "../ui/Badge";
import { ReceiptIcon } from "../ui/icons";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  invoiceDisplayStatus,
} from "@/lib/invoices";
import type { PublicInvoice } from "@/lib/types";
import { FaturaAvancadaCard } from "./FaturaAvancadaCard";

export type FaturaComLink = PublicInvoice & { publicUrl: string | null };

// Uma fatura na lista do portal: o cartão detalhado (faturamento avançado) ou
// a linha simples das faturas antigas.
export function FaturaItem({ fatura, token, acento }: { fatura: FaturaComLink; token: string; acento?: string }) {
  // Faturamento avançado (migration 0098): cartão que abre com os detalhes.
  if (fatura.advanced) return <FaturaAvancadaCard fatura={fatura} token={token} acento={acento} />;
  const statusExibido = invoiceDisplayStatus(fatura);
  const Conteudo = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <ReceiptIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{fatura.description}</p>
          <p className="text-xs text-ink-muted">Vence em {formatarDataBR(fatura.due_date)}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-ink">{formatarMoeda(fatura.amount)}</span>
        <Badge tone={INVOICE_STATUS_TONE[statusExibido]}>{INVOICE_STATUS_LABEL[statusExibido]}</Badge>
      </div>
    </>
  );

  // Fatura que veio do Relatório mensal traz os serviços cobrados.
  const itens = fatura.items ?? [];
  if (itens.length > 0 && !fatura.publicUrl) {
    return (
      <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">{Conteudo}</div>
        <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5">
          {itens.map((item, i) =>
            // Serviço que faz parte do pacote: sem valor próprio.
            item.included ? (
              <li key={i} className="flex items-baseline justify-between gap-3 pl-3 text-xs text-ink-muted">
                <span className="min-w-0">{item.name}</span>
                <span className="flex-shrink-0">incluso</span>
              </li>
            ) : (
              <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-ink-muted">
                  {Number(item.quantity) !== 1 &&
                    `${Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} × `}
                  <span className="text-ink">{item.name}</span>
                  {item.detail && ` · ${item.detail}`}
                  {item.recurring && " · mensal"}
                </span>
                <span className="flex-shrink-0 tabular-nums text-ink">{formatarMoeda(Number(item.total))}</span>
              </li>
            )
          )}
        </ul>
      </div>
    );
  }

  return fatura.publicUrl ? (
    <a
      href={fatura.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 hover:border-brand/30 hover:bg-surface-hover"
    >
      {Conteudo}
    </a>
  ) : (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
      {Conteudo}
    </div>
  );
}
