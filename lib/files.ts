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
