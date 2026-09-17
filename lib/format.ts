// Formata uma data ISO como tempo relativo em português ("há 2 horas",
// "há 3 dias"...) — usado nos metadados da Wiki ("Atualizado há...").
export function formatarRelativo(iso: string): string {
  const data = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;

  const diffDias = Math.round(diffHoras / 24);
  if (diffDias === 1) return "há 1 dia";
  if (diffDias < 30) return `há ${diffDias} dias`;

  return data.toLocaleDateString("pt-BR");
}

// Formata o tamanho de um arquivo (bytes -> B/KB/MB/GB, com vírgula decimal
// como no Brasil) — usado nos cards e na lista de Arquivos.
export function formatarTamanho(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(".", ",")} GB`;
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Formata uma data ISO como "Hoje, 14:32" / "Ontem, 11:20" / "12 set, 2025"
// — usado na coluna "Atualizado" da lista de Arquivos.
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const agora = new Date();
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (data.toDateString() === agora.toDateString()) return `Hoje, ${hora}`;

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;

  const dia = data.getDate().toString().padStart(2, "0");
  return `${dia} ${MESES[data.getMonth()]}, ${data.getFullYear()}`;
}

// Formata uma data "YYYY-MM-DD" (sem hora, tipo due_date/vencimento) como
// "dd/mm/aaaa" — parse manual (não usa "new Date(str)") pra não sofrer
// com fuso horário virando o dia errado.
export function formatarDataBR(dataISO: string | null | undefined): string {
  if (!dataISO) return "";
  const partes = dataISO.slice(0, 10).split("-");
  if (partes.length !== 3) return dataISO;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

// Formata um valor numérico como moeda brasileira ("R$ 1.234,56") — usado
// nas Faturas.
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
