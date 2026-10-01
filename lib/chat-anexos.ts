import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeSeguro } from "@/lib/nome-arquivo";
import { LIMITE_ANEXO_MB } from "@/lib/chat";

// Envio de anexo do chat pro bucket privado "chat-files" (migration 0036).
// A pasta define quem pode abrir: dm/<idA>_<idB> ou canal/<id>.

export function pastaDaDm(eu: string, outro: string) {
  return `dm/${[eu, outro].sort().join("_")}`;
}

export function pastaDoCanal(channelId: string) {
  return `canal/${channelId}`;
}


export type AnexoEnviado = {
  attachment_path: string;
  attachment_name: string;
  attachment_mime: string;
  attachment_size: number;
};

export async function enviarAnexo(
  supabase: SupabaseClient,
  pasta: string,
  arquivo: File
): Promise<{ ok: true; anexo: AnexoEnviado } | { ok: false; erro: string }> {
  if (arquivo.size > LIMITE_ANEXO_MB * 1024 * 1024) {
    return { ok: false, erro: `O arquivo pode ter no máximo ${LIMITE_ANEXO_MB} MB.` };
  }
  const caminho = `${pasta}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
  const { error } = await supabase.storage.from("chat-files").upload(caminho, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
  });
  if (error) return { ok: false, erro: "Não deu pra enviar o arquivo. Tente de novo." };
  return {
    ok: true,
    anexo: {
      attachment_path: caminho,
      attachment_name: arquivo.name,
      attachment_mime: arquivo.type || "application/octet-stream",
      attachment_size: arquivo.size,
    },
  };
}
