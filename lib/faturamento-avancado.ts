// Faturamento avançado (migration 0098): cálculo da fatura, parcelas e tipos.
// O banco recalcula o total (trigger fn_fatura_avancada) com a mesma regra
// daqui; esta função serve pra mostrar o total enquanto a pessoa edita.

export type StatusDaFatura = "draft" | "pending" | "paid" | "cancelled";
export type StatusDaParcela = "pending" | "paid";

export interface ItemDaFatura {
  name: string;
  detail: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ParcelaDaFatura {
  id?: string;
  position: number;
  amount: number;
  due_date: string;
  status: StatusDaParcela;
  paid_at: string | null;
}

export interface FaturaAvancada {
  id: string;
  project_id: string;
  number: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: StatusDaFatura;
  paid_at: string | null;
  items: ItemDaFatura[] | null;
  discount: number;
  tax_percent: number;
  tax_label: string | null;
  tax_added: boolean;
  notes: string | null;
  // Mês de referência (migration 0100), sempre o dia 1.
  reference_month?: string | null;
  created_by_label: string | null;
  created_at: string;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface MesDeReferencia {
  chave: string; // "2026-09", ordena certo como texto
  rotulo: string; // "Setembro de 2026"
}

function mesDe(ano: number, mes: number): MesDeReferencia {
  const nome = MESES[mes - 1];
  return {
    chave: `${ano}-${String(mes).padStart(2, "0")}`,
    rotulo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`,
  };
}

// Mês a que a fatura se refere (migration 0100: reference_month). Nas faturas
// sem esse campo, tenta o "de <mês> de <ano>" da descrição e, por último, o
// mês em que foi criada.
export function mesDaFatura(f: { reference_month?: string | null; description: string; created_at?: string }): MesDeReferencia {
  if (f.reference_month && /^\d{4}-\d{2}/.test(f.reference_month)) {
    return mesDe(Number(f.reference_month.slice(0, 4)), Number(f.reference_month.slice(5, 7)));
  }
  const norma = f.description.normalize("NFC").toLowerCase();
  const achou = norma.match(/(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/);
  if (achou) {
    const indice = MESES.findIndex((m) => m === achou[1].replace("marco", "março"));
    if (indice >= 0) return mesDe(Number(achou[2]), indice + 1);
  }
  const criada = (f.created_at ?? new Date().toISOString()).slice(0, 7);
  return mesDe(Number(criada.slice(0, 4)), Number(criada.slice(5, 7)));
}

export interface Emissor {
  legal_name: string | null;
  document: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  pix_type: string | null;
  pix_key: string | null;
  bank_info: string | null;
  default_notes: string | null;
}

export interface DadosDoCliente {
  legal_name: string | null;
  document: string | null;
  address: string | null;
  billing_email: string | null;
  contact_name: string | null;
}

export const TIPOS_DE_PIX: { valor: string; rotulo: string }[] = [
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "cpf", rotulo: "CPF" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
];

const centavos = (valor: number) => Math.round(valor * 100);

// "1.234,56" ou "1234.56" -> 1234.56. Vazio ou inválido -> 0.
export function lerValor(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!limpo) return 0;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function totalDoItem(item: Pick<ItemDaFatura, "quantity" | "unit_price">): number {
  return centavos(item.quantity * item.unit_price) / 100;
}

export interface TotaisDaFatura {
  subtotal: number;
  desconto: number;
  base: number;
  imposto: number;
  total: number;
}

// subtotal - desconto = base; imposto = base x %; total = base (+ imposto se
// for somado). Tudo em centavos, pra não acumular erro de arredondamento.
export function calcularFatura(
  itens: Pick<ItemDaFatura, "quantity" | "unit_price">[],
  desconto: number,
  impostoPercentual: number,
  impostoSomado: boolean
): TotaisDaFatura {
  const subtotal = itens.reduce((soma, i) => soma + centavos(totalDoItem(i)), 0);
  const descontoC = Math.min(centavos(desconto), subtotal);
  const base = subtotal - descontoC;
  const imposto = Math.round((base * impostoPercentual) / 100);
  const total = base + (impostoSomado ? imposto : 0);
  return {
    subtotal: subtotal / 100,
    desconto: descontoC / 100,
    base: base / 100,
    imposto: imposto / 100,
    total: total / 100,
  };
}

function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("en-CA");
}

function somarMeses(dataISO: string, meses: number): string {
  const [a, m, dia] = dataISO.split("-").map(Number);
  const d = new Date(a, m - 1 + meses, 1, 12);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d.toLocaleDateString("en-CA");
}

// Divide o total em "quantidade" parcelas iguais (a diferença de centavos vai
// pra última) a partir do primeiro vencimento. "mensal" repete no mesmo dia
// de cada mês; senão soma "intervaloDias" entre uma e outra.
export function gerarParcelas(
  total: number,
  quantidade: number,
  primeiroVencimento: string,
  intervalo: "mensal" | number
): ParcelaDaFatura[] {
  const n = Math.max(1, Math.min(60, Math.floor(quantidade) || 1));
  const totalC = centavos(total);
  const base = Math.floor(totalC / n);
  return Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    amount: (i === n - 1 ? totalC - base * (n - 1) : base) / 100,
    due_date: intervalo === "mensal" ? somarMeses(primeiroVencimento, i) : somarDias(primeiroVencimento, intervalo * i),
    status: "pending" as const,
    paid_at: null,
  }));
}

export function somaDasParcelas(parcelas: Pick<ParcelaDaFatura, "amount">[]): number {
  return parcelas.reduce((s, p) => s + centavos(p.amount), 0) / 100;
}

export interface ResumoFinanceiro {
  emitido: number;
  pago: number;
  aberto: number;
  vencido: number;
  rascunhos: number;
}

// Totais de um conjunto de faturas (uma empresa ou o grupo todo). Rascunho e
// cancelada não entram nos valores. Com parcelas, "pago" e "aberto" saem delas;
// sem parcelas (fatura antiga), da própria fatura.
export function resumirFaturas(
  faturas: Pick<FaturaAvancada, "id" | "status" | "amount" | "due_date">[],
  parcelas: Record<string, Pick<ParcelaDaFatura, "amount" | "status" | "due_date">[]>
): ResumoFinanceiro {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  let emitido = 0;
  let pago = 0;
  let aberto = 0;
  let vencido = 0;
  let rascunhos = 0;
  for (const f of faturas) {
    if (f.status === "draft") {
      rascunhos += 1;
      continue;
    }
    if (f.status === "cancelled") continue;
    emitido += centavos(f.amount);
    const ps = parcelas[f.id] ?? [];
    if (ps.length > 0) {
      for (const p of ps) {
        if (p.status === "paid") pago += centavos(p.amount);
        else {
          aberto += centavos(p.amount);
          if (p.due_date < hoje) vencido += centavos(p.amount);
        }
      }
    } else if (f.status === "paid") {
      pago += centavos(f.amount);
    } else {
      aberto += centavos(f.amount);
      if (f.due_date < hoje) vencido += centavos(f.amount);
    }
  }
  return { emitido: emitido / 100, pago: pago / 100, aberto: aberto / 100, vencido: vencido / 100, rascunhos };
}

export function parcelaVencida(parcela: Pick<ParcelaDaFatura, "status" | "due_date">): boolean {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return parcela.status === "pending" && parcela.due_date < hoje;
}
