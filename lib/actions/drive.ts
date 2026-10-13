"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { abrirSessaoDeEnvio, descartarArquivo, driveConfigurado, liberarArquivo } from "@/lib/google-drive";

// Server Actions do envio de vídeo grande pro Google Drive (lib/google-drive.ts).
// Só quem está logado no d.hub usa. O arquivo em si nunca passa por aqui: a
// action só abre a sessão de envio e, no fim, libera o vídeo pra visualização.

const ID_DO_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;
const TAMANHO_MAXIMO = 5 * 1024 * 1024 * 1024; // 5 GB
// Formatos de vídeo aceitos (celular, câmera e editores).
const TIPOS_ACEITOS = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/mpeg",
  "video/3gpp",
]);

async function logado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

export type SessaoDeEnvio = { url: string } | { erro: string; naoConfigurado?: boolean };

export async function iniciarEnvioParaODrive(nome: string, tamanho: number, tipoMime: string): Promise<SessaoDeEnvio> {
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  if (!driveConfigurado()) {
    return { erro: "O Google Drive ainda não foi configurado no d.hub.", naoConfigurado: true };
  }
  if (typeof tipoMime !== "string" || !TIPOS_ACEITOS.has(tipoMime.toLowerCase())) {
    return { erro: "Formato de vídeo não aceito. Use .mp4, .mov, .webm, .m4v ou .mkv." };
  }
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_MAXIMO) {
    return { erro: "O vídeo passa do tamanho máximo aceito (5 GB)." };
  }
  // Nome limpo: sem caracteres de controle nem barras.
  const limpo = String(nome ?? "video")
    .replace(/[\u0000-\u001f\u007f/\\]/g, " ")
    .trim()
    .slice(0, 150);

  // O envio direto do navegador só é liberado pelo Google pra origem do d.hub.
  const cabecalhos = await headers();
  const host = cabecalhos.get("host") ?? "";
  const origemPedida = cabecalhos.get("origin");
  const origem = origemPedida ?? `https://${host}`;
  try {
    if (new URL(origem).host !== host) return { erro: "Origem do pedido não confere." };
  } catch {
    return { erro: "Origem do pedido inválida." };
  }

  try {
    const url = await abrirSessaoDeEnvio({ nome: limpo || "video", tipoMime: tipoMime.toLowerCase(), tamanho, origem });
    return { url };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu pra abrir o envio pro Drive." };
  }
}

export async function liberarVideoDoDrive(id: string): Promise<{ id: string } | { erro: string }> {
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  if (typeof id !== "string" || !ID_DO_DRIVE.test(id)) return { erro: "Código do vídeo inválido." };
  try {
    await liberarArquivo(id);
    return { id };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu pra liberar o vídeo no Drive." };
  }
}

// Envio que não chegou a virar post (o salvar falhou depois): joga o vídeo na
// lixeira do Drive pra não ficar arquivo público sem dono.
export async function descartarVideoDoDrive(id: string): Promise<void> {
  if (!(await logado())) return;
  if (typeof id !== "string" || !ID_DO_DRIVE.test(id)) return;
  try {
    await descartarArquivo(id);
  } catch {
    // Melhor esforço: o arquivo fica na pasta "d.hub - videos dos posts".
  }
}
