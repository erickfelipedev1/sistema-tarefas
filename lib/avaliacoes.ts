// Avaliações mensais dos colaboradores (/relatorio, aba Avaliações): tipos e
// contas, sem banco. As linhas vêm de evaluations (migration 0046).

export const CRITERIOS = [
  { chave: "quality", rotulo: "Qualidade das entregas", dica: "Capricho, acerto de primeira, pouco retrabalho." },
  { chave: "deadlines", rotulo: "Prazos", dica: "Entrega no combinado e avisa antes quando não vai dar." },
  { chave: "communication", rotulo: "Comunicação", dica: "Clareza com o time e com o cliente, responde no tempo certo." },
  { chave: "proactivity", rotulo: "Proatividade", dica: "Antecipa problema, propõe melhoria, não espera pedir." },
  { chave: "teamwork", rotulo: "Trabalho em equipe", dica: "Ajuda os colegas, divide o que sabe, aceita ajuda." },
] as const;

export type ChaveCriterio = (typeof CRITERIOS)[number]["chave"];

export const ESCALA: Record<number, string> = {
  1: "Muito abaixo do esperado",
  2: "Abaixo do esperado",
  3: "Dentro do esperado",
  4: "Acima do esperado",
  5: "Muito acima do esperado",
};

export type Notas = Record<ChaveCriterio, number | null>;

export interface Avaliacao extends Notas {
  id: string;
  person_id: string;
  month: string; // YYYY-MM-01
  strengths: string;
  improvements: string;
  status: "draft" | "sent";
  sent_at: string | null;
  reply: string | null;
  replied_at: string | null;
}

export const COLUNAS_DA_AVALIACAO =
  "id, person_id, month, quality, deadlines, communication, proactivity, teamwork, strengths, improvements, status, sent_at, reply, replied_at";

// Média das notas preenchidas (uma casa), ou null se não tem nenhuma.
export function mediaDasNotas(a: Notas): number | null {
  const notas = CRITERIOS.map((c) => a[c.chave]).filter((n): n is number => typeof n === "number");
  if (notas.length === 0) return null;
  return Math.round((notas.reduce((soma, n) => soma + n, 0) / notas.length) * 10) / 10;
}

export function notasCompletas(a: Notas) {
  return CRITERIOS.every((c) => typeof a[c.chave] === "number");
}

export function formatarMedia(media: number | null) {
  return media === null ? "—" : media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Como a avaliação está, pra quem avalia.
export function situacao(a: Pick<Avaliacao, "status" | "reply"> | null) {
  if (!a) return { rotulo: "Sem avaliação", tom: "neutral" as const };
  if (a.status === "draft") return { rotulo: "Rascunho", tom: "warning" as const };
  if (a.reply) return { rotulo: "Respondida", tom: "success" as const };
  return { rotulo: "Enviada", tom: "brand" as const };
}
