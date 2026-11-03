"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import {
  calcularFatura,
  gerarParcelas,
  lerValor,
  parcelaVencida,
  resumirFaturas,
  somaDasParcelas,
  TIPOS_DE_PIX,
  totalDoItem,
  type DadosDoCliente,
  type Emissor,
  type FaturaAvancada,
  type ItemDaFatura,
  type ParcelaDaFatura,
  type StatusDaFatura,
} from "@/lib/faturamento-avancado";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon, ReceiptIcon, Trash2Icon, XIcon } from "../ui/icons";

const ERRO_SEM_MIGRATION =
  "Não deu pra carregar o faturamento. Confira se a migration 0098_faturamento_avancado.sql já foi rodada no Supabase.";

const campo =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Tom = "neutral" | "brand" | "success" | "warning" | "danger";
const ROTULO: Record<StatusDaFatura | "overdue", { texto: string; tom: Tom }> = {
  draft: { texto: "Rascunho", tom: "neutral" },
  pending: { texto: "Em aberto", tom: "brand" },
  overdue: { texto: "Vencida", tom: "danger" },
  paid: { texto: "Paga", tom: "success" },
  cancelled: { texto: "Cancelada", tom: "neutral" },
};

interface LinhaEditavel {
  name: string;
  detail: string;
  quantity: string;
  unit_price: string;
}

interface ParcelaEditavel {
  amount: string;
  due_date: string;
}

interface Rascunho {
  id?: string;
  description: string;
  itens: LinhaEditavel[];
  desconto: string;
  impostoPercentual: string;
  impostoRotulo: string;
  impostoSomado: boolean;
  observacoes: string;
  quantidadeDeParcelas: string;
  primeiroVencimento: string;
  intervalo: string;
  parcelas: ParcelaEditavel[];
  parcelasManuais: boolean;
}

function hojeMaisDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("en-CA");
}

function rascunhoVazio(observacoesPadrao: string): Rascunho {
  return {
    description: "",
    itens: [{ name: "", detail: "", quantity: "1", unit_price: "" }],
    desconto: "",
    impostoPercentual: "",
    impostoRotulo: "",
    impostoSomado: false,
    observacoes: observacoesPadrao,
    quantidadeDeParcelas: "1",
    primeiroVencimento: hojeMaisDias(7),
    intervalo: "mensal",
    parcelas: [],
    parcelasManuais: false,
  };
}

function rascunhoDe(f: FaturaAvancada, parcelas: ParcelaDaFatura[]): Rascunho {
  const dinheiro = (n: number) => (n ? String(n).replace(".", ",") : "");
  return {
    id: f.id,
    description: f.description,
    itens: (f.items ?? []).map((i) => ({
      name: i.name,
      detail: i.detail ?? "",
      quantity: String(i.quantity).replace(".", ","),
      unit_price: dinheiro(i.unit_price),
    })),
    desconto: dinheiro(f.discount),
    impostoPercentual: dinheiro(f.tax_percent),
    impostoRotulo: f.tax_label ?? "",
    impostoSomado: f.tax_added,
    observacoes: f.notes ?? "",
    quantidadeDeParcelas: String(Math.max(1, parcelas.length)),
    primeiroVencimento: parcelas[0]?.due_date ?? f.due_date,
    intervalo: "mensal",
    parcelas: parcelas.map((p) => ({ amount: dinheiro(p.amount), due_date: p.due_date })),
    parcelasManuais: true,
  };
}

function statusExibido(f: FaturaAvancada, parcelas: ParcelaDaFatura[]): StatusDaFatura | "overdue" {
  if (f.status === "pending" && parcelas.some(parcelaVencida)) return "overdue";
  return f.status;
}

// Aba "Faturamento" do cliente (migration 0098): faturas com número, itens,
// desconto, imposto e parcelas, mais os dados de quem emite e de quem paga.
// Só aparece pra quem pode ver faturamento e pros clientes com
// projects.faturamento_avancado.
export default function FaturamentoDoCliente({
  projectId,
  currentUserLabel,
  empresas = [],
}: {
  projectId: string;
  currentUserLabel: string;
  // Empresas deste cliente (migration 0099): quando há, aparece a aba "Empresas".
  empresas?: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const [secao, setSecao] = useState<"faturas" | "empresas" | "dados">(empresas.length > 0 ? "empresas" : "faturas");
  const [faturas, setFaturas] = useState<FaturaAvancada[]>([]);
  const [parcelas, setParcelas] = useState<Record<string, ParcelaDaFatura[]>>({});
  const [emissor, setEmissor] = useState<Emissor | null>(null);
  const [dadosCliente, setDadosCliente] = useState<DadosDoCliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [editor, setEditor] = useState<Rascunho | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: fs, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .eq("advanced", true)
        .order("created_at", { ascending: false });
      if (!ativo) return;
      if (error) {
        setErroCarregar(ERRO_SEM_MIGRATION);
        setCarregando(false);
        return;
      }
      const lista = (fs ?? []) as FaturaAvancada[];
      const ids = lista.map((f) => f.id);
      const [{ data: ps }, { data: em }, { data: cl }] = await Promise.all([
        ids.length
          ? supabase.from("invoice_installments").select("*").in("invoice_id", ids).order("position")
          : Promise.resolve({ data: [] as (ParcelaDaFatura & { invoice_id: string })[] }),
        supabase.from("billing_issuer").select("*").eq("id", 1).maybeSingle(),
        supabase.from("client_billing_info").select("*").eq("project_id", projectId).maybeSingle(),
      ]);
      if (!ativo) return;
      const mapa: Record<string, ParcelaDaFatura[]> = {};
      ((ps ?? []) as (ParcelaDaFatura & { invoice_id: string })[]).forEach((p) => {
        (mapa[p.invoice_id] ??= []).push(p);
      });
      setFaturas(lista);
      setParcelas(mapa);
      setEmissor((em as Emissor | null) ?? null);
      setDadosCliente((cl as DadosDoCliente | null) ?? null);
      setErroCarregar(null);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function recarregarFatura(id: string) {
    const [{ data: f }, { data: ps }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
      supabase.from("invoice_installments").select("*").eq("invoice_id", id).order("position"),
    ]);
    if (!f) return;
    setFaturas((atual) => {
      const nova = f as FaturaAvancada;
      return atual.some((x) => x.id === id) ? atual.map((x) => (x.id === id ? nova : x)) : [nova, ...atual];
    });
    setParcelas((atual) => ({ ...atual, [id]: (ps ?? []) as ParcelaDaFatura[] }));
  }

  async function emitir(f: FaturaAvancada) {
    const { error } = await supabase.from("invoices").update({ status: "pending" }).eq("id", f.id);
    if (error) return setAviso("Não deu pra emitir a fatura. Tenta de novo.");
    setAviso(null);
    await recarregarFatura(f.id);
  }

  async function mudarStatus(f: FaturaAvancada, status: "cancelled" | "pending") {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", f.id);
    if (error) return setAviso("Não deu pra mudar o status da fatura. Tenta de novo.");
    setAviso(null);
    await recarregarFatura(f.id);
  }

  async function excluir(f: FaturaAvancada) {
    const nome = f.number ? `a fatura ${f.number}` : "este rascunho";
    if (!window.confirm(`Excluir ${nome}? Isso não pode ser desfeito.`)) return;
    const { error } = await supabase.from("invoices").delete().eq("id", f.id);
    if (error) return setAviso("Não deu pra excluir a fatura. Tenta de novo.");
    setAviso(null);
    setFaturas((atual) => atual.filter((x) => x.id !== f.id));
  }

  async function pagarParcela(f: FaturaAvancada, p: ParcelaDaFatura, paga: boolean) {
    if (!p.id) return;
    const { error } = await supabase
      .from("invoice_installments")
      .update({ status: paga ? "paid" : "pending", paid_at: paga ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) return setAviso("Não deu pra atualizar a parcela. Tenta de novo.");
    setAviso(null);
    await recarregarFatura(f.id);
  }

  if (carregando) return <p className="py-8 text-center text-sm text-ink-muted">Carregando faturamento...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
          {[
            ...(empresas.length > 0 ? [{ v: "empresas" as const, label: `Empresas (${empresas.length})` }] : []),
            { v: "faturas" as const, label: `Faturas (${faturas.length})` },
            { v: "dados" as const, label: "Dados de cobrança" },
          ].map((op) => (
            <button
              key={op.v}
              type="button"
              onClick={() => setSecao(op.v)}
              className={`rounded-md px-3 py-1.5 ${secao === op.v ? "bg-brand-light text-brand-forte" : "text-ink-muted hover:text-ink"}`}
            >
              {op.label}
            </button>
          ))}
        </div>
        {secao === "faturas" && (
          <Button size="sm" disabled={!!erroCarregar} onClick={() => setEditor(rascunhoVazio(emissor?.default_notes ?? ""))}>
            <PlusIcon className="h-3.5 w-3.5" />
            Nova fatura
          </Button>
        )}
      </div>

      {erroCarregar && <p className="text-xs text-danger">{erroCarregar}</p>}
      {aviso && <p className="text-xs text-danger">{aviso}</p>}

      {secao === "empresas" ? (
        <ResumoDasEmpresas empresas={empresas} />
      ) : secao === "dados" ? (
        <DadosDeCobranca
          projectId={projectId}
          emissor={emissor}
          cliente={dadosCliente}
          aoSalvarEmissor={setEmissor}
          aoSalvarCliente={setDadosCliente}
        />
      ) : faturas.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            className="py-14"
            icon={<ReceiptIcon className="h-7 w-7" />}
            title="Nenhuma fatura ainda"
            description="Crie a primeira fatura com itens, desconto, imposto e parcelas. Ela fica como rascunho até você emitir."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {faturas.map((f) => {
            const ps = parcelas[f.id] ?? [];
            const exibido = statusExibido(f, ps);
            const rotulo = ROTULO[exibido];
            const pagas = ps.filter((p) => p.status === "paid").length;
            const podeEditar = f.status !== "cancelled" && pagas === 0;
            return (
              <div key={f.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      {f.number ? `Fatura ${f.number}` : "Fatura"}
                    </p>
                    <p className="mt-0.5 break-words text-sm font-semibold text-ink">{f.description}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {(f.items ?? []).length} {(f.items ?? []).length === 1 ? "item" : "itens"}
                      {f.discount > 0 && ` · desconto ${formatarMoeda(f.discount)}`}
                      {f.tax_percent > 0 &&
                        ` · ${f.tax_label || "imposto"} ${String(f.tax_percent).replace(".", ",")}% ${f.tax_added ? "somado" : "incluso"}`}
                      {f.created_by_label && ` · criada por ${f.created_by_label}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-ink">{formatarMoeda(f.amount)}</span>
                      <Badge tone={rotulo.tom}>{rotulo.texto}</Badge>
                    </div>
                    {ps.length > 0 && (
                      <span className="text-[11px] text-ink-muted">
                        {pagas} de {ps.length} {ps.length === 1 ? "parcela paga" : "parcelas pagas"}
                      </span>
                    )}
                  </div>
                </div>

                {ps.length > 0 && (
                  <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                    {ps.map((p) => {
                      const vencida = parcelaVencida(p) && f.status !== "draft" && f.status !== "cancelled";
                      return (
                        <li key={p.position} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span className="text-ink-muted">
                            Parcela {p.position}/{ps.length} · vence {formatarDataBR(p.due_date)}
                            {p.status === "paid" && p.paid_at && ` · paga em ${formatarDataBR(p.paid_at)}`}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`font-medium ${vencida ? "text-danger" : "text-ink"}`}>{formatarMoeda(p.amount)}</span>
                            {p.status === "paid" ? (
                              <Badge tone="success">Paga</Badge>
                            ) : vencida ? (
                              <Badge tone="danger">Vencida</Badge>
                            ) : (
                              <Badge tone="neutral">A pagar</Badge>
                            )}
                            {f.status !== "draft" && f.status !== "cancelled" && (
                              <Button size="sm" variant="secondary" onClick={() => pagarParcela(f, p, p.status !== "paid")}>
                                {p.status === "paid" ? "Desfazer" : "Marcar paga"}
                              </Button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
                  <a
                    href={`/api/faturas/${f.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-hover"
                  >
                    Baixar PDF
                  </a>
                  {f.status === "draft" && (
                    <Button size="sm" onClick={() => emitir(f)}>
                      Emitir ao cliente
                    </Button>
                  )}
                  {podeEditar && (
                    <Button size="sm" variant="secondary" onClick={() => setEditor(rascunhoDe(f, ps))}>
                      Editar
                    </Button>
                  )}
                  {f.status === "cancelled" ? (
                    <Button size="sm" variant="secondary" onClick={() => mudarStatus(f, "pending")}>
                      Reabrir
                    </Button>
                  ) : (
                    f.status !== "draft" && (
                      <Button size="sm" variant="ghost" onClick={() => mudarStatus(f, "cancelled")}>
                        Cancelar fatura
                      </Button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => excluir(f)}
                    title="Excluir fatura"
                    aria-label="Excluir fatura"
                    className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!podeEditar && f.status !== "cancelled" && (
                  <p className="mt-2 text-right text-[11px] text-ink-muted">
                    Com parcela paga a fatura não pode ser editada. Desfaça os pagamentos para editar.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <EditorDeFatura
          rascunho={editor}
          projectId={projectId}
          currentUserLabel={currentUserLabel}
          aoFechar={() => setEditor(null)}
          aoSalvar={async (id) => {
            setEditor(null);
            await recarregarFatura(id);
          }}
        />
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold ${tom === "danger" && valor > 0 ? "text-danger" : tom === "success" ? "text-success" : "text-ink"}`}>
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}

// Resumo das empresas do cliente (migration 0099): total do grupo e de cada
// empresa, com o detalhe das faturas e o atalho para o faturamento dela.
function ResumoDasEmpresas({ empresas }: { empresas: { id: string; name: string }[] }) {
  const supabase = createClient();
  const [faturas, setFaturas] = useState<FaturaAvancada[]>([]);
  const [parcelas, setParcelas] = useState<Record<string, ParcelaDaFatura[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const ids = empresas.map((e) => e.id);
      const { data: fs, error } = await supabase
        .from("invoices")
        .select("*")
        .in("project_id", ids)
        .order("due_date", { ascending: false });
      if (!ativo) return;
      if (error) {
        setErro("Não deu pra carregar as faturas das empresas. Tenta de novo.");
        setCarregando(false);
        return;
      }
      const lista = (fs ?? []) as FaturaAvancada[];
      const { data: ps } = lista.length
        ? await supabase.from("invoice_installments").select("*").in("invoice_id", lista.map((f) => f.id)).order("position")
        : { data: [] as (ParcelaDaFatura & { invoice_id: string })[] };
      if (!ativo) return;
      const mapa: Record<string, ParcelaDaFatura[]> = {};
      ((ps ?? []) as (ParcelaDaFatura & { invoice_id: string })[]).forEach((p) => {
        (mapa[p.invoice_id] ??= []).push(p);
      });
      setFaturas(lista);
      setParcelas(mapa);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas.map((e) => e.id).join(",")]);

  if (carregando) return <p className="py-8 text-center text-sm text-ink-muted">Carregando empresas...</p>;
  if (erro) return <p className="text-xs text-danger">{erro}</p>;

  const geral = resumirFaturas(faturas, parcelas);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Todas as empresas</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Indicador rotulo="Emitido" valor={geral.emitido} />
          <Indicador rotulo="Pago" valor={geral.pago} tom="success" />
          <Indicador rotulo="Em aberto" valor={geral.aberto} />
          <Indicador rotulo="Vencido" valor={geral.vencido} tom="danger" />
        </div>
        {geral.rascunhos > 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            {geral.rascunhos} {geral.rascunhos === 1 ? "rascunho" : "rascunhos"} ainda não emitido{geral.rascunhos === 1 ? "" : "s"} (o cliente não vê).
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {empresas.map((e) => {
          const dela = faturas.filter((f) => f.project_id === e.id);
          const r = resumirFaturas(dela, parcelas);
          return (
            <section key={e.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-sm font-semibold text-ink">{e.name}</h3>
                <Link href={`/projetos/${e.id}?aba=faturamento`} className="flex-shrink-0 text-xs font-medium text-brand-forte hover:underline">
                  Abrir
                </Link>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-ink-muted">Emitido</dt>
                <dd className="text-right font-medium text-ink">{formatarMoeda(r.emitido)}</dd>
                <dt className="text-ink-muted">Pago</dt>
                <dd className="text-right font-medium text-success">{formatarMoeda(r.pago)}</dd>
                <dt className="text-ink-muted">Em aberto</dt>
                <dd className="text-right font-medium text-ink">{formatarMoeda(r.aberto)}</dd>
                <dt className="text-ink-muted">Vencido</dt>
                <dd className={`text-right font-medium ${r.vencido > 0 ? "text-danger" : "text-ink"}`}>{formatarMoeda(r.vencido)}</dd>
              </dl>
              {dela.length === 0 ? (
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">Nenhuma fatura ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {dela.slice(0, 6).map((f) => {
                    const rotulo = ROTULO[statusExibido(f, parcelas[f.id] ?? [])];
                    return (
                      <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                        <span className="min-w-0 truncate text-ink-muted">
                          {f.number ? `${f.number} · ` : ""}
                          {f.description}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-1.5">
                          <span className="font-medium text-ink">{formatarMoeda(f.amount)}</span>
                          <Badge tone={rotulo.tom}>{rotulo.texto}</Badge>
                        </span>
                      </li>
                    );
                  })}
                  {dela.length > 6 && <li className="pt-2 text-[11px] text-ink-muted">+ {dela.length - 6} faturas. Abra a empresa para ver todas.</li>}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Janela({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl"
        style={{ maxHeight: "92dvh" }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function EditorDeFatura({
  rascunho,
  projectId,
  currentUserLabel,
  aoFechar,
  aoSalvar,
}: {
  rascunho: Rascunho;
  projectId: string;
  currentUserLabel: string;
  aoFechar: () => void;
  aoSalvar: (id: string) => Promise<void>;
}) {
  const supabase = createClient();
  const [f, setF] = useState<Rascunho>(rascunho);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const itensLidos = f.itens.map((i) => ({ quantity: lerValor(i.quantity), unit_price: lerValor(i.unit_price) }));
  const totais = useMemo(
    () => calcularFatura(itensLidos, lerValor(f.desconto), lerValor(f.impostoPercentual), f.impostoSomado),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(itensLidos), f.desconto, f.impostoPercentual, f.impostoSomado]
  );

  // Enquanto ninguém mexeu nas parcelas à mão, elas acompanham o total, a
  // quantidade, o primeiro vencimento e o intervalo.
  useEffect(() => {
    if (f.parcelasManuais) return;
    const geradas = gerarParcelas(
      totais.total,
      Number(f.quantidadeDeParcelas) || 1,
      f.primeiroVencimento || hojeMaisDias(7),
      f.intervalo === "mensal" ? "mensal" : Number(f.intervalo)
    );
    setF((atual) => ({
      ...atual,
      parcelas: geradas.map((p) => ({ amount: String(p.amount).replace(".", ","), due_date: p.due_date })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totais.total, f.quantidadeDeParcelas, f.primeiroVencimento, f.intervalo, f.parcelasManuais]);

  const mudar = (parte: Partial<Rascunho>) => setF((atual) => ({ ...atual, ...parte }));
  const mudarItem = (i: number, parte: Partial<LinhaEditavel>) =>
    setF((atual) => ({ ...atual, itens: atual.itens.map((x, k) => (k === i ? { ...x, ...parte } : x)) }));
  const mudarParcela = (i: number, parte: Partial<ParcelaEditavel>) =>
    setF((atual) => ({
      ...atual,
      parcelasManuais: true,
      parcelas: atual.parcelas.map((x, k) => (k === i ? { ...x, ...parte } : x)),
    }));

  const parcelasLidas = f.parcelas.map((p, i) => ({ position: i + 1, amount: lerValor(p.amount), due_date: p.due_date }));
  const somaParcelas = somaDasParcelas(parcelasLidas);
  const diferenca = Math.round((totais.total - somaParcelas) * 100) / 100;

  async function salvar(emitir: boolean) {
    setErro(null);
    if (!f.description.trim()) return setErro("Dê uma descrição à fatura.");
    const itens = f.itens.filter((i) => i.name.trim() || lerValor(i.unit_price) > 0);
    if (itens.length === 0) return setErro("Adicione pelo menos um item.");
    if (itens.some((i) => !i.name.trim())) return setErro("Todo item precisa de um nome.");
    if (itens.some((i) => lerValor(i.quantity) <= 0)) return setErro("A quantidade de cada item precisa ser maior que zero.");
    if (totais.total <= 0) return setErro("O total da fatura precisa ser maior que zero.");
    if (lerValor(f.desconto) > totais.subtotal) return setErro("O desconto não pode ser maior que o subtotal.");
    if (lerValor(f.impostoPercentual) > 100) return setErro("O percentual de imposto não pode passar de 100%.");
    if (parcelasLidas.length === 0 || parcelasLidas.some((p) => !p.due_date)) return setErro("Preencha o vencimento de todas as parcelas.");
    if (parcelasLidas.some((p) => p.amount <= 0)) return setErro("Cada parcela precisa ter valor maior que zero.");
    if (Math.abs(diferenca) > 0.009) {
      return setErro(`As parcelas somam ${formatarMoeda(somaParcelas)}, mas o total é ${formatarMoeda(totais.total)}.`);
    }

    setSalvando(true);
    const itensGravados: ItemDaFatura[] = itens.map((i) => {
      const quantity = lerValor(i.quantity);
      const unit_price = lerValor(i.unit_price);
      return { name: i.name.trim(), detail: i.detail.trim() || null, quantity, unit_price, total: totalDoItem({ quantity, unit_price }) };
    });
    const campos = {
      description: f.description.trim(),
      amount: totais.total,
      due_date: parcelasLidas[0].due_date,
      advanced: true,
      items: itensGravados,
      discount: totais.desconto,
      tax_percent: lerValor(f.impostoPercentual),
      tax_label: f.impostoRotulo.trim() || null,
      tax_added: f.impostoSomado,
      notes: f.observacoes.trim() || null,
    };

    let id = f.id ?? "";
    if (f.id) {
      const { error } = await supabase.from("invoices").update(campos).eq("id", f.id);
      if (error) {
        setSalvando(false);
        return setErro(`Não deu pra salvar a fatura. ${error.message}`);
      }
    } else {
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          ...campos,
          project_id: projectId,
          status: emitir ? "pending" : "draft",
          created_by_label: currentUserLabel || null,
        })
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        return setErro(`Não deu pra salvar a fatura. ${error?.message ?? ""}`.trim());
      }
      id = data.id as string;
    }

    // Troca as parcelas pelas novas (a edição só é liberada sem parcela paga).
    const { error: erroApagar } = await supabase.from("invoice_installments").delete().eq("invoice_id", id);
    const { error: erroParcelas } = erroApagar
      ? { error: erroApagar }
      : await supabase.from("invoice_installments").insert(
          parcelasLidas.map((p) => ({ invoice_id: id, position: p.position, amount: p.amount, due_date: p.due_date }))
        );
    setSalvando(false);
    if (erroParcelas) {
      await aoSalvar(id);
      return;
    }
    if (f.id && emitir) await supabase.from("invoices").update({ status: "pending" }).eq("id", id).eq("status", "draft");
    await aoSalvar(id);
  }

  return (
    <Janela titulo={f.id ? "Editar fatura" : "Nova fatura"} aoFechar={aoFechar}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <Campo label="Descrição">
          <input
            autoFocus
            value={f.description}
            maxLength={160}
            onChange={(e) => mudar({ description: e.target.value })}
            placeholder="Ex.: Gestão de redes sociais — novembro"
            className={campo}
          />
        </Campo>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Itens</h3>
          <div className="space-y-2">
            {f.itens.map((item, i) => (
              <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-xl border border-line p-2">
                <input
                  value={item.name}
                  onChange={(e) => mudarItem(i, { name: e.target.value })}
                  placeholder="Serviço"
                  aria-label="Nome do item"
                  className={`${campo} col-span-12 sm:col-span-5`}
                />
                <input
                  value={item.quantity}
                  inputMode="decimal"
                  onChange={(e) => mudarItem(i, { quantity: e.target.value })}
                  placeholder="Qtd"
                  aria-label="Quantidade"
                  className={`${campo} col-span-3 sm:col-span-2`}
                />
                <input
                  value={item.unit_price}
                  inputMode="decimal"
                  onChange={(e) => mudarItem(i, { unit_price: e.target.value })}
                  placeholder="Valor unit. (R$)"
                  aria-label="Valor unitário"
                  className={`${campo} col-span-5 sm:col-span-3`}
                />
                <div className="col-span-4 flex items-center justify-end gap-1 pt-2 sm:col-span-2">
                  <span className="text-sm font-medium text-ink">{formatarMoeda(itensLidos[i].quantity * itensLidos[i].unit_price)}</span>
                  {f.itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => mudar({ itens: f.itens.filter((_, k) => k !== i) })}
                      aria-label="Remover item"
                      className="rounded-md p-1 text-ink-muted hover:bg-danger-light hover:text-danger"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input
                  value={item.detail}
                  onChange={(e) => mudarItem(i, { detail: e.target.value })}
                  placeholder="Detalhe (opcional): o que está incluso"
                  aria-label="Detalhe do item"
                  className={`${campo} col-span-12`}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => mudar({ itens: [...f.itens, { name: "", detail: "", quantity: "1", unit_price: "" }] })}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar item
          </Button>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          <Campo label="Desconto (R$)">
            <input value={f.desconto} inputMode="decimal" onChange={(e) => mudar({ desconto: e.target.value })} placeholder="0,00" className={campo} />
          </Campo>
          <Campo label="Imposto (%)">
            <input value={f.impostoPercentual} inputMode="decimal" onChange={(e) => mudar({ impostoPercentual: e.target.value })} placeholder="0" className={campo} />
          </Campo>
          <Campo label="Nome do imposto">
            <input value={f.impostoRotulo} maxLength={40} onChange={(e) => mudar({ impostoRotulo: e.target.value })} placeholder="Ex.: ISS" className={campo} />
          </Campo>
          <Campo label="Imposto">
            <select value={f.impostoSomado ? "somado" : "incluso"} onChange={(e) => mudar({ impostoSomado: e.target.value === "somado" })} className={campo}>
              <option value="incluso">Já incluso no valor</option>
              <option value="somado">Somado ao total</option>
            </select>
          </Campo>
        </section>

        <section className="rounded-xl bg-surface-hover/60 p-3 text-sm">
          <Linha rotulo="Subtotal" valor={formatarMoeda(totais.subtotal)} />
          {totais.desconto > 0 && <Linha rotulo="Desconto" valor={`− ${formatarMoeda(totais.desconto)}`} />}
          {lerValor(f.impostoPercentual) > 0 && (
            <Linha
              rotulo={`${f.impostoRotulo.trim() || "Imposto"} (${f.impostoPercentual}%) ${f.impostoSomado ? "· somado" : "· incluso"}`}
              valor={formatarMoeda(totais.imposto)}
            />
          )}
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-base font-semibold text-ink">
            <span>Total</span>
            <span>{formatarMoeda(totais.total)}</span>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Parcelas</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Quantidade">
              <input
                value={f.quantidadeDeParcelas}
                inputMode="numeric"
                onChange={(e) => mudar({ quantidadeDeParcelas: e.target.value.replace(/\D/g, "").slice(0, 2), parcelasManuais: false })}
                className={campo}
              />
            </Campo>
            <Campo label="Primeiro vencimento">
              <input type="date" value={f.primeiroVencimento} onChange={(e) => mudar({ primeiroVencimento: e.target.value, parcelasManuais: false })} className={campo} />
            </Campo>
            <Campo label="Intervalo">
              <select value={f.intervalo} onChange={(e) => mudar({ intervalo: e.target.value, parcelasManuais: false })} className={campo}>
                <option value="mensal">Todo mês</option>
                <option value="30">A cada 30 dias</option>
                <option value="15">A cada 15 dias</option>
                <option value="7">A cada 7 dias</option>
              </select>
            </Campo>
          </div>
          <ul className="mt-3 space-y-2">
            {f.parcelas.map((p, i) => (
              <li key={i} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-2 text-xs text-ink-muted sm:col-span-2">
                  {i + 1}/{f.parcelas.length}
                </span>
                <input
                  type="date"
                  value={p.due_date}
                  onChange={(e) => mudarParcela(i, { due_date: e.target.value })}
                  aria-label={`Vencimento da parcela ${i + 1}`}
                  className={`${campo} col-span-5 sm:col-span-5`}
                />
                <input
                  value={p.amount}
                  inputMode="decimal"
                  onChange={(e) => mudarParcela(i, { amount: e.target.value })}
                  aria-label={`Valor da parcela ${i + 1}`}
                  className={`${campo} col-span-5 sm:col-span-5`}
                />
              </li>
            ))}
          </ul>
          {Math.abs(diferenca) > 0.009 && (
            <p className="mt-2 text-xs text-danger">
              As parcelas somam {formatarMoeda(somaParcelas)} e o total é {formatarMoeda(totais.total)}.
              {f.parcelasManuais && (
                <button type="button" onClick={() => mudar({ parcelasManuais: false })} className="ml-1 font-medium underline">
                  Refazer parcelas
                </button>
              )}
            </p>
          )}
        </section>

        <Campo label="Observações (aparecem na fatura)">
          <textarea value={f.observacoes} rows={3} maxLength={2000} onChange={(e) => mudar({ observacoes: e.target.value })} className={campo} />
        </Campo>

        {erro && <p className="text-xs text-danger">{erro}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
        <Button type="button" variant="secondary" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="button" variant="secondary" disabled={salvando} onClick={() => salvar(false)}>
          {salvando ? "Salvando..." : f.id ? "Salvar" : "Salvar rascunho"}
        </Button>
        {!f.id && (
          <Button type="button" disabled={salvando} onClick={() => salvar(true)}>
            Salvar e emitir
          </Button>
        )}
      </div>
    </Janela>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-ink-muted">
      <span>{rotulo}</span>
      <span className="text-ink">{valor}</span>
    </div>
  );
}

function DadosDeCobranca({
  projectId,
  emissor,
  cliente,
  aoSalvarEmissor,
  aoSalvarCliente,
}: {
  projectId: string;
  emissor: Emissor | null;
  cliente: DadosDoCliente | null;
  aoSalvarEmissor: (e: Emissor) => void;
  aoSalvarCliente: (c: DadosDoCliente) => void;
}) {
  const supabase = createClient();
  const [em, setEm] = useState<Emissor>({
    legal_name: emissor?.legal_name ?? "",
    document: emissor?.document ?? "",
    address: emissor?.address ?? "",
    email: emissor?.email ?? "",
    phone: emissor?.phone ?? "",
    pix_type: emissor?.pix_type ?? "",
    pix_key: emissor?.pix_key ?? "",
    bank_info: emissor?.bank_info ?? "",
    default_notes: emissor?.default_notes ?? "",
  });
  const [cl, setCl] = useState<DadosDoCliente>({
    legal_name: cliente?.legal_name ?? "",
    document: cliente?.document ?? "",
    address: cliente?.address ?? "",
    billing_email: cliente?.billing_email ?? "",
    contact_name: cliente?.contact_name ?? "",
  });
  const [msg, setMsg] = useState<{ quem: "em" | "cl"; texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState<"em" | "cl" | null>(null);

  const vazioParaNulo = <T extends Record<string, string | null>>(o: T) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && v.trim() ? v.trim() : null])) as { [K in keyof T]: string | null };

  async function salvarEmissor() {
    setSalvando("em");
    const dados = vazioParaNulo(em as unknown as Record<string, string | null>);
    const { error } = await supabase.from("billing_issuer").upsert({ id: 1, ...dados, updated_at: new Date().toISOString() });
    setSalvando(null);
    if (error) return setMsg({ quem: "em", texto: `Não deu pra salvar. ${error.message}`, erro: true });
    aoSalvarEmissor(dados as unknown as Emissor);
    setMsg({ quem: "em", texto: "Dados de quem emite salvos.", erro: false });
  }

  async function salvarCliente() {
    setSalvando("cl");
    const dados = vazioParaNulo(cl as unknown as Record<string, string | null>);
    const { error } = await supabase
      .from("client_billing_info")
      .upsert({ project_id: projectId, ...dados, updated_at: new Date().toISOString() });
    setSalvando(null);
    if (error) return setMsg({ quem: "cl", texto: `Não deu pra salvar. ${error.message}`, erro: true });
    aoSalvarCliente(dados as unknown as DadosDoCliente);
    setMsg({ quem: "cl", texto: "Dados do cliente salvos.", erro: false });
  }

  const v = (x: string | null) => x ?? "";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Quem emite (Now)</h3>
          <p className="text-xs text-ink-muted">Vale para todos os clientes. Aparece no PDF e na página da fatura.</p>
        </div>
        <Campo label="Razão social">
          <input value={v(em.legal_name)} onChange={(e) => setEm({ ...em, legal_name: e.target.value })} className={campo} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="CNPJ">
            <input value={v(em.document)} onChange={(e) => setEm({ ...em, document: e.target.value })} className={campo} />
          </Campo>
          <Campo label="Telefone / WhatsApp">
            <input value={v(em.phone)} onChange={(e) => setEm({ ...em, phone: e.target.value })} className={campo} />
          </Campo>
        </div>
        <Campo label="Endereço">
          <input value={v(em.address)} onChange={(e) => setEm({ ...em, address: e.target.value })} className={campo} />
        </Campo>
        <Campo label="E-mail">
          <input type="email" value={v(em.email)} onChange={(e) => setEm({ ...em, email: e.target.value })} className={campo} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Tipo da chave Pix">
            <select value={v(em.pix_type)} onChange={(e) => setEm({ ...em, pix_type: e.target.value })} className={campo}>
              <option value="">—</option>
              {TIPOS_DE_PIX.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Chave Pix" className="sm:col-span-2">
            <input value={v(em.pix_key)} onChange={(e) => setEm({ ...em, pix_key: e.target.value })} className={campo} />
          </Campo>
        </div>
        <Campo label="Dados bancários (opcional)">
          <textarea value={v(em.bank_info)} rows={2} onChange={(e) => setEm({ ...em, bank_info: e.target.value })} placeholder="Banco, agência, conta" className={campo} />
        </Campo>
        <Campo label="Observação padrão das faturas">
          <textarea value={v(em.default_notes)} rows={2} onChange={(e) => setEm({ ...em, default_notes: e.target.value })} className={campo} />
        </Campo>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${msg?.quem === "em" && msg.erro ? "text-danger" : "text-ink-muted"}`}>{msg?.quem === "em" ? msg.texto : ""}</span>
          <Button size="sm" disabled={salvando === "em"} onClick={salvarEmissor}>
            {salvando === "em" ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Quem paga (este cliente)</h3>
          <p className="text-xs text-ink-muted">Dados fiscais do cliente. Só a equipe de faturamento vê e edita.</p>
        </div>
        <Campo label="Razão social / nome">
          <input value={v(cl.legal_name)} onChange={(e) => setCl({ ...cl, legal_name: e.target.value })} className={campo} />
        </Campo>
        <Campo label="CNPJ / CPF">
          <input value={v(cl.document)} onChange={(e) => setCl({ ...cl, document: e.target.value })} className={campo} />
        </Campo>
        <Campo label="Endereço">
          <input value={v(cl.address)} onChange={(e) => setCl({ ...cl, address: e.target.value })} className={campo} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Contato de cobrança">
            <input value={v(cl.contact_name)} onChange={(e) => setCl({ ...cl, contact_name: e.target.value })} className={campo} />
          </Campo>
          <Campo label="E-mail de cobrança">
            <input type="email" value={v(cl.billing_email)} onChange={(e) => setCl({ ...cl, billing_email: e.target.value })} className={campo} />
          </Campo>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${msg?.quem === "cl" && msg.erro ? "text-danger" : "text-ink-muted"}`}>{msg?.quem === "cl" ? msg.texto : ""}</span>
          <Button size="sm" disabled={salvando === "cl"} onClick={salvarCliente}>
            {salvando === "cl" ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </section>
    </div>
  );
}
