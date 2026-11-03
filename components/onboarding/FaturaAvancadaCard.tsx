"use client";

import { useState } from "react";
import { Badge } from "../ui/Badge";
import { ReceiptIcon } from "../ui/icons";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import { calcularFatura, TIPOS_DE_PIX } from "@/lib/faturamento-avancado";
import type { PublicInvoice } from "@/lib/types";

// Fatura do faturamento avançado (migration 0098) no portal do cliente:
// resumo fechado e, ao abrir, itens, parcelas, como pagar (Pix com botão de
// copiar) e o PDF. Só leitura.
export function FaturaAvancadaCard({ fatura, token }: { fatura: PublicInvoice; token: string }) {
  const [aberta, setAberta] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const itens = fatura.items ?? [];
  const parcelas = fatura.installments ?? [];
  const pagas = parcelas.filter((p) => p.status === "paid").length;
  const quitada = fatura.status === "paid";
  const totais = calcularFatura(itens, fatura.discount ?? 0, fatura.tax_percent ?? 0, fatura.tax_added ?? false);
  const emissor = fatura.issuer;
  const tipoPix = TIPOS_DE_PIX.find((t) => t.valor === emissor?.pix_type)?.rotulo;
  const rotuloImposto = `${fatura.tax_label || "Imposto"} (${String(fatura.tax_percent ?? 0).replace(".", ",")}%)${
    fatura.tax_added ? "" : " · incluso"
  }`;

  async function copiarPix() {
    const chave = emissor?.pix_key;
    if (!chave) return;
    try {
      await navigator.clipboard.writeText(chave);
    } catch {
      // Navegador sem acesso à área de transferência: copia por um campo temporário.
      const campo = document.createElement("textarea");
      campo.value = chave;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(campo);
      }
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-surface-hover/50"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ReceiptIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">
              {fatura.number ? `${fatura.number} · ` : ""}
              {fatura.description}
            </p>
            <p className="text-xs text-ink-muted">
              {quitada ? "Fatura paga" : parcelas.length > 1 ? `${pagas} de ${parcelas.length} parcelas pagas` : "Aguardando pagamento"}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-ink">{formatarMoeda(fatura.amount)}</span>
          {quitada ? <Badge tone="success">Paga</Badge> : <Badge tone="brand">Em aberto</Badge>}
        </div>
      </button>

      {aberta && (
        <div className="space-y-4 border-t border-line px-3.5 py-4 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Emitente</p>
              <p className="mt-1 text-sm font-semibold text-ink">{emissor?.legal_name || "now d.gital"}</p>
              <p className="text-ink-muted">
                {[emissor?.document && `CNPJ ${emissor.document}`, emissor?.address, emissor?.email, emissor?.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Cliente</p>
              <p className="mt-1 text-sm font-semibold text-ink">{fatura.client?.legal_name || fatura.company || "—"}</p>
              <p className="text-ink-muted">
                {[
                  fatura.client?.document && `CNPJ/CPF ${fatura.client.document}`,
                  fatura.client?.address,
                  fatura.client?.billing_email,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          {itens.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Itens</p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {itens.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="text-ink">
                        {Number(item.quantity) !== 1 &&
                          `${Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} × `}
                        {item.name}
                      </span>
                      {item.detail && <span className="mt-0.5 block text-ink-muted">{item.detail}</span>}
                    </span>
                    <span className="flex-shrink-0 tabular-nums text-ink">
                      {Number(item.unit_price) > 0 ? formatarMoeda(Number(item.total)) : "incluso"}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 ml-auto max-w-xs space-y-1">
                <div className="flex justify-between text-ink-muted">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums text-ink">{formatarMoeda(totais.subtotal)}</dd>
                </div>
                {totais.desconto > 0 && (
                  <div className="flex justify-between text-ink-muted">
                    <dt>Desconto</dt>
                    <dd className="tabular-nums text-ink">− {formatarMoeda(totais.desconto)}</dd>
                  </div>
                )}
                {(fatura.tax_percent ?? 0) > 0 && (
                  <div className="flex justify-between text-ink-muted">
                    <dt>{rotuloImposto}</dt>
                    <dd className="tabular-nums text-ink">
                      {fatura.tax_added ? "+ " : ""}
                      {formatarMoeda(totais.imposto)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-1.5 text-sm font-semibold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatarMoeda(fatura.amount)}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Sem datas de vencimento: parcelas só quando há mais de uma ou já houve pagamento. */}
          {(parcelas.length > 1 || parcelas.some((p) => p.status === "paid")) && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {parcelas.length > 1 ? "Parcelas" : "Pagamento"}
              </p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {parcelas.map((p) => (
                  <li key={p.position} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-ink-muted">
                      {parcelas.length > 1 ? `Parcela ${p.position}/${parcelas.length}` : "Fatura"}
                      {p.status === "paid" && p.paid_at && ` · paga em ${formatarDataBR(p.paid_at)}`}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular-nums text-ink">{formatarMoeda(p.amount)}</span>
                      {p.status === "paid" ? <Badge tone="success">Paga</Badge> : <Badge tone="neutral">A pagar</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!quitada && (emissor?.pix_key || emissor?.bank_info) && (
            <div className="rounded-lg border border-brand/30 bg-brand-light/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Como pagar</p>
              {emissor?.pix_key && (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-ink-muted">Pix{tipoPix ? ` · ${tipoPix}` : ""}</p>
                    <p className="break-all text-sm font-semibold text-ink">{emissor.pix_key}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copiarPix}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
                  >
                    {copiado ? "Copiado!" : "Copiar chave"}
                  </button>
                </div>
              )}
              {emissor?.bank_info && <p className="mt-2 whitespace-pre-wrap text-ink-muted">{emissor.bank_info}</p>}
            </div>
          )}

          {fatura.notes && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Observações</p>
              <p className="whitespace-pre-wrap text-ink-muted">{fatura.notes}</p>
            </div>
          )}

          <div className="flex justify-end">
            <a
              href={`/api/progresso/${token}/faturas/${fatura.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-hover"
            >
              Baixar PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
