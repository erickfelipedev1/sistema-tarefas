import type { ComponentType, SVGProps } from "react";
import {
  FileBadgeIcon,
  FileGridIcon,
  FileSlideIcon,
  FileTextIcon,
} from "@/components/ui/icons";

export type TipoTone = "neutral" | "brand" | "success" | "warning" | "danger";

export interface TipoArquivo {
  label: string;
  tone: TipoTone;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// O banco não guarda um campo de "tipo" — só dá pra deduzir pela extensão do
// nome do arquivo, que é o que fazemos aqui (nada inventado).
const TIPOS: Record<string, TipoArquivo> = {
  pdf: { label: "PDF", tone: "danger", Icon: FileBadgeIcon },
  doc: { label: "Word", tone: "brand", Icon: FileTextIcon },
  docx: { label: "Word", tone: "brand", Icon: FileTextIcon },
  xls: { label: "Excel", tone: "success", Icon: FileGridIcon },
  xlsx: { label: "Excel", tone: "success", Icon: FileGridIcon },
  csv: { label: "Excel", tone: "success", Icon: FileGridIcon },
  ppt: { label: "PowerPoint", tone: "warning", Icon: FileSlideIcon },
  pptx: { label: "PowerPoint", tone: "warning", Icon: FileSlideIcon },
};

export function tipoArquivo(fileName: string): TipoArquivo {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (
    TIPOS[ext] ?? {
      label: ext ? ext.toUpperCase() : "Arquivo",
      tone: "neutral",
      Icon: FileTextIcon,
    }
  );
}

// Um arquivo do Drive "Geral" — é o formato usado pela lista "Recentemente
// acessados" do dashboard de Arquivos. Arquivos ligados a um projeto não
// passam por aqui: eles vivem só na aba "Arquivos" do projeto (ver
// DriveBrowser), então esse tipo nem carrega project_id.
export interface ArquivoComContexto {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  owner_id: string | null;
  uploaded_by_label: string | null;
  created_at: string;
}

// "Local" do arquivo dentro do Drive "Geral" — Meus arquivos ou
// Compartilhados (arquivos de projeto não aparecem nessa lista central).
export function localDoArquivo(
  arquivo: Pick<ArquivoComContexto, "owner_id">,
  currentUserId: string
): { label: string; href: string } {
  if (arquivo.owner_id === currentUserId) {
    return { label: "Meus arquivos", href: "/arquivos/meus" };
  }
  return { label: "Compartilhados", href: "/arquivos/compartilhados" };
}

// Bucket + política de acesso: só os arquivos de "Meus arquivos" (owner_id
// preenchido) ficam no bucket privado — o resto sempre foi público.
export function bucketDoArquivo(ownerId: string | null): string {
  return ownerId ? "drive-files-private" : "drive-files";
}
