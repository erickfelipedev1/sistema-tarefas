// Coisas das atas de reunião (migration 0082) usadas no navegador e no servidor.

// Bucket privado das gravações: <ata>/<arquivo>.
export const BUCKET_DAS_GRAVACOES = "ata-audio";

// Gravação que passa disso não cabe no Supabase (o limite de arquivo dele é 50 MB):
// vai pro Google Drive do d.hub.
export const LIMITE_DA_GRAVACAO_MB = 45;

// No Drive, a ata guarda "<ata>/drive-<código>" em audio_path (o banco exige o
// prefixo da pasta da ata). Devolve o código do arquivo no Drive, ou null se a
// gravação está no bucket.
export function idDaGravacaoNoDrive(audioPath: string | null | undefined): string | null {
  const m = /^[0-9a-f-]{36}\/drive-([A-Za-z0-9_-]{10,100})$/i.exec(audioPath ?? "");
  return m ? m[1] : null;
}

export function caminhoDaGravacaoNoDrive(ataId: string, idNoDrive: string): string {
  return `${ataId}/drive-${idNoDrive}`;
}

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
