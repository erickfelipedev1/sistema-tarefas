import { linkDoArquivo, linkParaBaixar } from "@/lib/arquivos";

// Anexo da tarefa: no Supabase (task-attachments/<caminho>) ou, quando passa do
// limite do Supabase, no Google Drive, guardado como "drive:<código>".
export const PREFIXO_DO_DRIVE = "drive:";

export function idDoDriveDoAnexo(caminho: string): string | null {
  return caminho.startsWith(PREFIXO_DO_DRIVE) ? caminho.slice(PREFIXO_DO_DRIVE.length) : null;
}

export function linkDoAnexo(caminho: string): string {
  const id = idDoDriveDoAnexo(caminho);
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : linkDoArquivo("task-attachments", caminho);
}

export function linkParaBaixarAnexo(caminho: string, nome: string): string {
  const id = idDoDriveDoAnexo(caminho);
  return id
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
    : linkParaBaixar("task-attachments", caminho, nome);
}

// Pra mostrar dentro do d.hub (visualizador): o player do próprio Drive.
export function embedDoAnexo(caminho: string): string | null {
  const id = idDoDriveDoAnexo(caminho);
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : null;
}

export function miniaturaDoAnexoNoDrive(caminho: string): string | null {
  const id = idDoDriveDoAnexo(caminho);
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200` : null;
}
