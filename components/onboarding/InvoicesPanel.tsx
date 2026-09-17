import { Badge } from "../ui/Badge";
import { ReceiptIcon } from "../ui/icons";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  invoiceDisplayStatus,
} from "@/lib/invoices";
import type { PublicInvoice } from "@/lib/types";

type FaturaComLink = PublicInvoice & { publicUrl: string | null };

// Faturas do projeto — só leitura pro cliente (a equipe cadastra na aba
// "Faturas" de /projetos/[id], via InvoicesManager). Faturas canceladas
// não aparecem aqui: não fazem sentido pro cliente ver.
export function InvoicesPanel({ invoices }: { invoices: FaturaComLink[] }) {
  const faturasVisiveis = invoices.filter((f) => f.status !== "cancelled");

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Faturas</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Acompanhe aqui as faturas do seu projeto.
      </p>

      {faturasVisiveis.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-6 text-center">
          <p className="text-xs text-ink-muted">
            Ainda não há faturas cadastradas aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {faturasVisiveis.map((fatura) => {
            const statusExibido = invoiceDisplayStatus(fatura);
            const Conteudo = (
              <>
                <div className="flex min-w-0 items-center gap-2.5">
                  <ReceiptIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{fatura.description}</p>
                    <p className="text-xs text-ink-muted">
                      Vence em {formatarDataBR(fatura.due_date)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {formatarMoeda(fatura.amount)}
                  </span>
                  <Badge tone={INVOICE_STATUS_TONE[statusExibido]}>
                    {INVOICE_STATUS_LABEL[statusExibido]}
                  </Badge>
                </div>
              </>
            );

            return fatura.publicUrl ? (
              <a
                key={fatura.id}
                href={fatura.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 hover:border-brand/30 hover:bg-surface-hover"
              >
                {Conteudo}
              </a>
            ) : (
              <div
                key={fatura.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
              >
                {Conteudo}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
