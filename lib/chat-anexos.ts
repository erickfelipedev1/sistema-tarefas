import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeSeguro } from "@/lib/nome-arquivo";
import { LIMITE_ANEXO_MB } from "@/lib/chat";
import type { Message } from "@/lib/types";

// Envio de anexo do chat pro bucket privado "chat-files" (migration 0036).
// A pasta define quem pode abrir: dm/<idA>_<idB> ou canal/<id>.

export function pastaDaDm(eu: string, outro: string) {
  return `dm/${[eu, outro].sort().join("_")}`;
}

export function pastaDoCanal(channelId: string) {
  return `canal/${channelId}`;
}


// Apaga uma mensagem que a própria pessoa enviou (migration 0052) e, se
// tinha anexo, o arquivo. Devolve o texto do erro, ou null se apagou.
// Sem a policy de delete o banco não reclama: só não apaga nada — por isso a
// conferência é pela linha que volta, não pelo erro.
export async function apagarMensagem(supabase: SupabaseClient, mensagem: Message, eu: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("messages")
    .delete()
    .eq("id", mensagem.id)
    .eq("sender_id", eu)
    .select("id");
  if (error || !data || data.length === 0) {
    return "Não deu pra apagar a mensagem. Confere se a migration 0052_apagar_mensagem.sql já foi rodada no Supabase.";
  }
  // O arquivo sai depois; se falhar, só fica ocupando espaço (ninguém mais o vê).
  if (mensagem.attachment_path) {
    void supabase.storage.from("chat-files").remove([mensagem.attachment_path]);
  }
  return null;
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
