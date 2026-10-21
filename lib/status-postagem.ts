import type { SupabaseClient } from "@supabase/supabase-js";

// Status da postagem (migration 0086): etiquetas de andamento da peça na
// tarefa do tipo Postagem. A cor é a do post no Calendário de postagem.
export interface StatusDaPostagem {
  id: string;
  name: string;
  color: string; // "#RRGGBB"
  position: number;
}

export async function carregarStatusDaPostagem(supabase: SupabaseClient): Promise<StatusDaPostagem[]> {
  const { data } = await supabase
    .from("post_status_labels")
    .select("id, name, color, position")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as StatusDaPostagem[];
}

// Texto escuro ou claro, o que lê melhor sobre a cor.
export function textoSobre(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luz > 0.4 ? "#1f2312" : "#ffffff";
}
