// Coisas das atas de reunião (migration 0082) usadas no navegador e no servidor.

// Bucket privado das gravações: <ata>/<arquivo>.
export const BUCKET_DAS_GRAVACOES = "ata-audio";

// Tamanho máximo de uma gravação enviada (o limite de arquivo do Supabase).
export const LIMITE_DA_GRAVACAO_MB = 50;

// "1h 05min" / "12min 30s" a partir de segundos.
export function duracaoLegivel(segundos: number | null | undefined): string {
  if (!segundos || segundos < 0) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
