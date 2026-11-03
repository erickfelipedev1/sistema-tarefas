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

function FaturaItem({ fatura }: { fatura: FaturaComLink }) {
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

// O que ainda falta pagar numa lista de faturas (sem as pagas e canceladas).
function totalEmAberto(lista: FaturaComLink[]) {
  return lista.filter((f) => f.status === "pending").reduce((soma, f) => soma + Number(f.amount), 0);
}

// Faturas do projeto — só leitura pro cliente (a equipe cadastra na aba
// "Faturas" de /projetos/[id], via InvoicesManager). Faturas canceladas
// não aparecem aqui: não fazem sentido pro cliente ver.
// Quando o cliente é dono de empresas (migration 0099), as faturas vêm
// agrupadas por empresa, cada grupo com o que ainda está em aberto.
export function InvoicesPanel({ invoices }: { invoices: FaturaComLink[] }) {
  const faturasVisiveis = invoices.filter((f) => f.status !== "cancelled");
  const proprias = faturasVisiveis.filter((f) => !f.company);
  const empresas = Array.from(new Set(faturasVisiveis.map((f) => f.company).filter((c): c is string => !!c))).sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
  const grupos =
    empresas.length === 0
      ? [{ titulo: null as string | null, lista: faturasVisiveis }]
      : [
          ...(proprias.length > 0 ? [{ titulo: "Faturas próprias" as string | null, lista: proprias }] : []),
          ...empresas.map((nome) => ({ titulo: nome as string | null, lista: faturasVisiveis.filter((f) => f.company === nome) })),
        ];

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Faturas</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {empresas.length > 0 ? "Acompanhe aqui as faturas de cada uma das suas empresas." : "Acompanhe aqui as faturas do seu projeto."}
      </p>

      {faturasVisiveis.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-6 text-center">
          <p className="text-xs text-ink-muted">Ainda não há faturas cadastradas aqui.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grupos.map((g) => {
            const aberto = totalEmAberto(g.lista);
            return (
              <section key={g.titulo ?? "todas"}>
                {g.titulo && (
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">{g.titulo}</h3>
                    {aberto > 0 && (
                      <span className="text-xs text-ink-muted">
                        Em aberto: <span className="font-semibold text-ink">{formatarMoeda(aberto)}</span>
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {g.lista.map((fatura) => (
                    <FaturaItem key={fatura.id} fatura={fatura} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
