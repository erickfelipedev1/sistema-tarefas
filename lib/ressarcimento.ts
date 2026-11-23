import { formatarDataBR } from "@/lib/format";
import { linkDoArquivo } from "@/lib/arquivos";

// Ressarcimento de despesas (migration 0123). Funções puras, sem rede.

export const BUCKET_DOS_RESSARCIMENTOS = "ressarcimentos";
export const MAX_ANEXOS = 5;
export const LIMITE_DO_ANEXO = 10 * 1024 * 1024;
export const ACEITA_ANEXO = "image/*,application/pdf";

export type EmpresaDoRessarcimento = "now_dgital" | "won";
export const EMPRESAS: Record<EmpresaDoRessarcimento, string> = { now_dgital: "now d.gital", won: "Won" };
export const ORDEM_DAS_EMPRESAS: EmpresaDoRessarcimento[] = ["now_dgital", "won"];

export type MotivoDoRessarcimento = "transporte" | "alimentacao" | "compras" | "grafica" | "recarga" | "outro";
export const MOTIVOS: Record<MotivoDoRessarcimento, string> = {
  transporte: "Transporte (Uber, ônibus, táxi)",
  alimentacao: "Alimentação",
  compras: "Compras e materiais",
  grafica: "Gráfica e impressão",
  recarga: "Recarga de celular",
  outro: "Outro",
};

export type StatusDoRessarcimento = "pendente" | "enviado" | "pago" | "recusado";
export const STATUS_DO_RESSARCIMENTO: Record<
  StatusDoRessarcimento,
  { rotulo: string; tom: "neutral" | "brand" | "success" | "danger" }
> = {
  pendente: { rotulo: "Pendente", tom: "neutral" },
  enviado: { rotulo: "Enviado ao financeiro", tom: "brand" },
  pago: { rotulo: "Pago", tom: "success" },
  recusado: { rotulo: "Recusado", tom: "danger" },
};

export interface AnexoDoRessarcimento {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface Ressarcimento {
  id: string;
  solicitante_id: string;
  empresa: EmpresaDoRessarcimento;
  nome: string;
  pix: string;
  data_despesa: string;
  valor: number;
  motivo: MotivoDoRessarcimento;
  descricao: string;
  anexos: AnexoDoRessarcimento[];
  status: StatusDoRessarcimento;
  lote: string | null;
  enviado_em: string | null;
  pago_em: string | null;
  pago_por: string | null;
  observacao_financeiro: string | null;
  created_at: string;
  updated_at: string;
}

// O PostgREST devolve numeric como número ou texto: normaliza ao ler.
export function normalizarRessarcimento(linha: unknown): Ressarcimento {
  const r = linha as Ressarcimento & { valor: number | string };
  return { ...r, valor: Number(r.valor), anexos: Array.isArray(r.anexos) ? r.anexos : [] };
}

// Aceita "25,90", "25.90", "1.234,56", "1,234.56", "1.234" e "R$ 30". O último
// separador com 1 ou 2 casas depois é o decimal; o resto é milhar. Na dúvida
// (mais de 2 casas decimais, vírgulas repetidas) devolve null: é dinheiro, a
// pessoa digita de novo em vez de o valor sair errado.
export function lerValor(texto: string): number | null {
  let t = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    // Os dois: o que vem por último é o decimal.
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula >= 0) {
    if (t.indexOf(",") !== virgula) return null;
    t = t.replace(",", ".");
  } else if (ponto >= 0) {
    const grupos = t.split(".");
    const milhar = grupos.slice(1).every((g) => g.length === 3) && grupos[0] !== "0" && grupos[0].length <= 3;
    if (grupos.length > 2) {
      if (!milhar) return null;
      t = grupos.join("");
    } else if (milhar) {
      t = grupos.join(""); // "1.234" = mil duzentos e trinta e quatro
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000) return null;
  return n;
}

// Hoje (AAAA-MM-DD) em São Paulo.
export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function rotuloDoLote(lote: string): string {
  return `Fechamento de ${formatarDataBR(lote)}`;
}

function celula(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

// Texto livre que começa com = + - @ vira fórmula no Excel: ganha um ' na
// frente. Chave PIX de celular ("+55 13 9...") fica como está.
function semFormula(valor: string, ehPix = false): string {
  if (/^[=@\t\r]/.test(valor)) return `'${valor}`;
  if (/^[+-]/.test(valor) && !(ehPix && /^[+-]?[\d\s().-]+$/.test(valor))) return `'${valor}`;
  return valor;
}

export function csvDosRessarcimentos(itens: Ressarcimento[], origem: string): string {
  const ordenados = [...itens].sort(
    (a, b) =>
      ORDEM_DAS_EMPRESAS.indexOf(a.empresa) - ORDEM_DAS_EMPRESAS.indexOf(b.empresa) ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.data_despesa.localeCompare(b.data_despesa)
  );
  const linhas = [
    ["Empresa", "Nome", "Chave PIX", "Data da despesa", "Valor (R$)", "Motivo", "Descrição", "Status", "Lançado em", "Comprovantes"],
    ...ordenados.map((r) => [
      EMPRESAS[r.empresa] ?? r.empresa,
      semFormula(r.nome),
      semFormula(r.pix, true),
      formatarDataBR(r.data_despesa),
      r.valor.toFixed(2).replace(".", ","),
      MOTIVOS[r.motivo] ?? r.motivo,
      semFormula(r.descricao),
      STATUS_DO_RESSARCIMENTO[r.status]?.rotulo ?? r.status,
      new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      r.anexos.map((a) => `${origem}${linkDoArquivo(BUCKET_DOS_RESSARCIMENTOS, a.path)}`).join(" | "),
    ]),
  ];
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}
