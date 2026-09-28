"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/lib/types";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  invoiceDisplayStatus,
} from "@/lib/invoices";
import { formatarDataBR, formatarMoeda } from "@/lib/format";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { PlusIcon, ReceiptIcon, Trash2Icon } from "./ui/icons";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Aba "Faturas" dentro de /projetos/[id] — gerenciamento interno (a equipe
// cria, marca como paga, cancela e exclui). O que o cliente vê é só
// leitura, na página pública /progresso/<token> (components/onboarding/InvoicesPanel.tsx),
// alimentada pela função get_project_invoices (migration 0029).
export default function InvoicesManager({
  projectId,
  currentUserLabel,
}: {
  projectId: string;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroDescricao, setErroDescricao] = useState<string | null>(null);
  const [erroValor, setErroValor] = useState<string | null>(null);
  const [erroPrazo, setErroPrazo] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: false });
      if (ativo) {
        setInvoices(data ?? []);
        setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const canal = supabase
      .channel(`invoices-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        (payload) => {
          setInvoices((current) => {
            if (payload.eventType === "INSERT") {
              const nova = payload.new as Invoice;
              if (nova.project_id !== projectId) return current;
              if (current.some((i) => i.id === nova.id)) return current;
              return [nova, ...current].sort((a, b) =>
                b.due_date.localeCompare(a.due_date)
              );
            }
            if (payload.eventType === "UPDATE") {
              const atualizada = payload.new as Invoice;
              if (atualizada.project_id !== projectId) return current;
              return current.map((i) =>
                i.id === atualizada.id ? atualizada : i
              );
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as Invoice).id;
              return current.filter((i) => i.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function limparForm() {
    setDescription("");
    setAmount("");
    setDueDate("");
    setArquivo(null);
    setErroDescricao(null);
    setErroValor(null);
    setErroPrazo(null);
    setErroEnvio(null);
    setMostrarForm(false);
  }

  async function criarFatura() {
    const descricaoValida = description.trim() !== "";
    const valorNumerico = Number(amount.replace(",", "."));
    const valorValido = amount.trim() !== "" && !Number.isNaN(valorNumerico) && valorNumerico > 0;
    const prazoValido = dueDate.trim() !== "";

    setErroDescricao(descricaoValida ? null : "Descreve o que essa fatura cobre.");
    setErroValor(valorValido ? null : "Informa um valor válido.");
    setErroPrazo(prazoValido ? null : "Escolhe a data de vencimento.");
    if (!descricaoValida || !valorValido || !prazoValido) return;

    setSalvando(true);
    setErroEnvio(null);

    let filePath: string | null = null;
    if (arquivo) {
      const caminho = `${projectId}/${Date.now()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage
        .from("invoices")
        .upload(caminho, arquivo);
      if (erroUpload) {
        setSalvando(false);
        setErroEnvio(
          "Não deu pra enviar o anexo. Confere se a migration 0029_client_invoices.sql já foi rodada no Supabase."
        );
        return;
      }
      filePath = caminho;
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        project_id: projectId,
        description: description.trim(),
        amount: valorNumerico,
        due_date: dueDate,
        file_path: filePath,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    setSalvando(false);
    if (error || !data) {
      setErroEnvio(
        "Não foi possível criar a fatura. Confere se a migration 0029_client_invoices.sql já foi rodada no Supabase."
      );
      return;
    }

    setInvoices((current) =>
      current.some((i) => i.id === data.id)
        ? current
        : [data, ...current].sort((a, b) => b.due_date.localeCompare(a.due_date))
    );
    limparForm();
  }

  async function marcarComoPaga(fatura: Invoice) {
    setInvoices((current) =>
      current.map((i) =>
        i.id === fatura.id
          ? { ...i, status: "paid", paid_at: new Date().toISOString() }
          : i
      )
    );
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", fatura.id);
  }

  async function reabrir(fatura: Invoice) {
    setInvoices((current) =>
      current.map((i) =>
        i.id === fatura.id ? { ...i, status: "pending", paid_at: null } : i
      )
    );
    await supabase
      .from("invoices")
      .update({ status: "pending", paid_at: null })
      .eq("id", fatura.id);
  }

  async function cancelar(fatura: Invoice) {
    const ok = window.confirm(`Cancelar a fatura "${fatura.description}"?`);
    if (!ok) return;
    setInvoices((current) =>
      current.map((i) => (i.id === fatura.id ? { ...i, status: "cancelled" } : i))
    );
    await supabase.from("invoices").update({ status: "cancelled" }).eq("id", fatura.id);
  }

  async function excluirFatura(fatura: Invoice) {
    const ok = window.confirm(`Excluir a fatura "${fatura.description}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    setInvoices((current) => current.filter((i) => i.id !== fatura.id));
    if (fatura.file_path) {
      await supabase.storage.from("invoices").remove([fatura.file_path]);
    }
    await supabase.from("invoices").delete().eq("id", fatura.id);
  }

  function abrirAnexo(fatura: Invoice) {
    if (!fatura.file_path) return;
    const { data } = supabase.storage.from("invoices").getPublicUrl(fatura.file_path);
    window.open(data.publicUrl, "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Faturas"
        subtitle="Cadastre as faturas do projeto — o cliente vê essa lista, só leitura, no link público dele."
        actions={
          mostrarForm ? (
            <Button variant="ghost" size="sm" onClick={limparForm}>
              Cancelar
            </Button>
          ) : (
            <Button onClick={() => setMostrarForm(true)}>
              <PlusIcon className="h-4 w-4" />
              Nova fatura
            </Button>
          )
        }
      />

      {mostrarForm && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
          <div className="space-y-4">
            <Campo label="Descrição" required error={erroDescricao}>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Mensalidade de setembro"
                className={campoClasse}
              />
            </Campo>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Valor (R$)" required error={erroValor}>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={campoClasse}
                />
              </Campo>
              <Campo label="Vencimento" required error={erroPrazo}>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={campoClasse}
                />
              </Campo>
            </div>

            <Campo label="Anexo (opcional)">
              <input
                type="file"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-surface-hover"
              />
            </Campo>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1.5">
            {erroEnvio && <p className="text-sm text-danger">{erroEnvio}</p>}
            <Button onClick={criarFatura} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar fatura"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {invoices.map((fatura) => {
          const statusExibido = invoiceDisplayStatus(fatura);
          return (
            <div
              key={fatura.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {fatura.description}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Vence em {formatarDataBR(fatura.due_date)}
                  {fatura.file_path && (
                    <>
                      {" · "}
                      <button
                        onClick={() => abrirAnexo(fatura)}
                        className="font-medium text-brand hover:underline"
                      >
                        Ver anexo
                      </button>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink">
                    {formatarMoeda(fatura.amount)}
                  </span>
                  <Badge tone={INVOICE_STATUS_TONE[statusExibido]}>
                    {INVOICE_STATUS_LABEL[statusExibido]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {(fatura.status === "pending") && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => marcarComoPaga(fatura)}>
                        Marcar como paga
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => cancelar(fatura)}>
                        Cancelar
                      </Button>
                    </>
                  )}
                  {fatura.status !== "pending" && (
                    <Button variant="secondary" size="sm" onClick={() => reabrir(fatura)}>
                      Reabrir
                    </Button>
                  )}
                  <button
                    onClick={() => excluirFatura(fatura)}
                    title="Excluir fatura"
                    className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!carregando && invoices.length === 0 && !mostrarForm && (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              className="py-14"
              icon={<ReceiptIcon className="h-7 w-7" />}
              title="Nenhuma fatura cadastrada"
              description="Crie a primeira fatura para o cliente acompanhar no link público dele."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
