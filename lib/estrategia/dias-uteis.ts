// Dias úteis do d.estratégia: segunda a sexta, sem feriado nacional. Funções
// puras (sem rede, sem banco), usadas pra montar os prazos das etapas.
//
// Feriados nacionais e os pontos facultativos que a equipe costuma folgar
// (Carnaval e Corpus Christi). Datas móveis calculadas pela Páscoa:
// 2026 = 5/4, 2027 = 28/3. Depois de 2027 a lista precisa ser ampliada: fora
// dela, só fim de semana é descontado (e a tela avisa, ver anoCoberto).

export const FERIADOS: Record<string, string> = {
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Sexta-feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-09-07": "Independência",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-25": "Natal",
  "2027-01-01": "Confraternização Universal",
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Sexta-feira Santa",
  "2027-04-21": "Tiradentes",
  "2027-05-01": "Dia do Trabalho",
  "2027-05-27": "Corpus Christi",
  "2027-09-07": "Independência",
  "2027-10-12": "Nossa Senhora Aparecida",
  "2027-11-02": "Finados",
  "2027-11-15": "Proclamação da República",
  "2027-11-20": "Consciência Negra",
  "2027-12-25": "Natal",
};

const ULTIMO_ANO_COBERTO = 2027;

// "AAAA-MM-DD" a partir de uma data (no calendário local, sem fuso).
export function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// "AAAA-MM-DD" -> Date ao meio-dia local (evita virar o dia por fuso).
export function deISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}

export function ehDiaUtil(iso: string): boolean {
  const dia = deISO(iso).getDay();
  return dia !== 0 && dia !== 6 && !(iso in FERIADOS);
}

// A data (AAAA-MM-DD) está dentro dos anos que a lista de feriados cobre?
export function anoCoberto(iso: string): boolean {
  return Number(iso.slice(0, 4)) <= ULTIMO_ANO_COBERTO;
}

// Primeiro dia útil a partir da data (ela mesma, se já for útil).
export function proximoDiaUtil(iso: string): string {
  const d = deISO(iso);
  while (!ehDiaUtil(paraISO(d))) d.setDate(d.getDate() + 1);
  return paraISO(d);
}

// Soma n dias úteis. O dia 0 é o primeiro dia útil a partir da data de início
// (o "D0" do Guia); D1 é o dia útil seguinte, e assim por diante.
export function somarDiasUteis(inicioISO: string, n: number): string {
  const d = deISO(proximoDiaUtil(inicioISO));
  let falta = Math.max(0, Math.trunc(n));
  while (falta > 0) {
    d.setDate(d.getDate() + 1);
    if (ehDiaUtil(paraISO(d))) falta -= 1;
  }
  return paraISO(d);
}

// Quantos dias úteis separam duas datas (b depois de a = positivo; não conta a).
export function diasUteisEntre(aISO: string, bISO: string): number {
  if (aISO === bISO) return 0;
  const sinal = aISO < bISO ? 1 : -1;
  const d = deISO(aISO);
  const fim = bISO;
  let total = 0;
  for (let guarda = 0; guarda < 4000; guarda++) {
    d.setDate(d.getDate() + sinal);
    const iso = paraISO(d);
    if (ehDiaUtil(iso)) total += sinal;
    if (iso === fim) break;
  }
  return total;
}
