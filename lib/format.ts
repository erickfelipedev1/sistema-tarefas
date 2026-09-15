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
