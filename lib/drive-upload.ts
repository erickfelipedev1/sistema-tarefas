"use client";

import { descartarVideoDoDrive, iniciarEnvioParaODrive, liberarVideoDoDrive } from "@/lib/actions/drive";

// Vídeo acima disso vai pro Google Drive em vez do Supabase (o limite de
// upload do plano gratuito do Supabase é 50 MB por arquivo).
export const LIMITE_DO_SUPABASE = 45 * 1024 * 1024;

const PEDACO = 8 * 1024 * 1024; // múltiplo de 256 KiB, como o Drive exige
const TENTATIVAS = 4;

export type ResultadoDoEnvio = { id: string } | { erro: string; naoConfigurado?: boolean };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// O código do arquivo na resposta final do Drive (null se vier ilegível).
function lerId(texto: string): string | null {
  try {
    const id = (JSON.parse(texto || "{}") as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

// Vídeo que subiu mas não virou post (o salvar falhou): vai pra lixeira do Drive.
export async function descartarVideosDoDrive(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => descartarVideoDoDrive(id).catch(() => undefined)));
}

type RespostaDoPedaco = { status: number; texto: string; recebidoAte: number | null };

// Um PUT com XMLHttpRequest (dá pra acompanhar o progresso e o status 308
// "continue" do envio resumível aparece como resposta normal).
function colocar(
  url: string,
  corpo: Blob | null,
  faixa: string,
  aoProgresso?: (enviados: number) => void
): Promise<RespostaDoPedaco> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", faixa);
    if (aoProgresso) xhr.upload.onprogress = (e) => aoProgresso(e.loaded);
    xhr.onload = () => {
      const range = xhr.getResponseHeader("Range"); // "bytes=0-1234" (se o Google deixar ler)
      const fim = range?.match(/-(\d+)$/)?.[1];
      resolve({ status: xhr.status, texto: xhr.responseText, recebidoAte: fim ? Number(fim) + 1 : null });
    };
    xhr.onerror = () => reject(new Error("rede"));
    xhr.ontimeout = () => reject(new Error("rede"));
    xhr.send(corpo);
  });
}

// Envia o vídeo pro Drive em pedaços, direto do navegador. "aoProgresso" recebe
// de 0 a 1. Devolve o código do arquivo no Drive, já liberado pra visualização.
export async function enviarVideoParaODrive(
  arquivo: File,
  aoProgresso: (fracao: number) => void
): Promise<ResultadoDoEnvio> {
  try {
    return await enviar(arquivo, aoProgresso);
  } catch {
    // Qualquer exceção (rede, sessão expirada, servidor fora) vira mensagem:
    // o formulário nunca fica preso em "salvando".
    return { erro: "Não deu pra enviar o vídeo pro Drive agora. Confira a conexão e tente de novo." };
  }
}

async function enviar(arquivo: File, aoProgresso: (fracao: number) => void): Promise<ResultadoDoEnvio> {
  const sessao = await iniciarEnvioParaODrive(arquivo.name, arquivo.size, arquivo.type || "video/mp4");
  if (!("url" in sessao)) return { erro: sessao.erro, naoConfigurado: sessao.naoConfigurado };

  const total = arquivo.size;
  let inicio = 0;
  let idDoArquivo: string | null = null;
  let falhasSeguidas = 0;

  while (inicio < total) {
    const fim = Math.min(inicio + PEDACO, total);
    try {
      const r = await colocar(
        sessao.url,
        arquivo.slice(inicio, fim),
        `bytes ${inicio}-${fim - 1}/${total}`,
        (n) => aoProgresso(Math.min(1, (inicio + n) / total))
      );
      if (r.status === 200 || r.status === 201) {
        idDoArquivo = lerId(r.texto);
        inicio = total;
      } else if (r.status === 308) {
        // "Continue": segue de onde o Drive diz que recebeu (ou do fim do pedaço).
        inicio = Math.min(Math.max(r.recebidoAte ?? fim, inicio), total);
      } else if (r.status >= 500 || r.status === 429 || r.status === 408) {
        throw new Error("instavel");
      } else {
        return { erro: `O Drive recusou o envio (${r.status}). ${r.texto.slice(0, 160)}`.trim() };
      }
      falhasSeguidas = 0;
    } catch {
      falhasSeguidas += 1;
      if (falhasSeguidas >= TENTATIVAS) {
        return { erro: "A conexão caiu durante o envio pro Drive. Tente de novo." };
      }
      await esperar(1500 * falhasSeguidas);
      // Pergunta ao Drive até onde ele recebeu, pra continuar dali.
      try {
        const estado = await colocar(sessao.url, null, `bytes */${total}`);
        // Se o navegador não consegue ler até onde o Drive recebeu, recomeça do
        // último pedaço confirmado (não do zero).
        if (estado.status === 308) inicio = estado.recebidoAte ?? inicio;
        else if (estado.status === 200 || estado.status === 201) {
          idDoArquivo = lerId(estado.texto);
          inicio = total;
        }
      } catch {
        // Sem resposta: tenta o mesmo pedaço de novo.
      }
    }
  }

  if (!idDoArquivo) return { erro: "O Drive não devolveu o código do vídeo. Tente de novo." };
  aoProgresso(1);

  // Liberar o vídeo pra visualização: tenta algumas vezes antes de desistir
  // (o envio já foi inteiro, não vale perder tudo por um tropeço).
  let ultimoErro = "Não deu pra liberar o vídeo no Drive.";
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const liberado = await liberarVideoDoDrive(idDoArquivo);
      if ("id" in liberado) return { id: liberado.id };
      ultimoErro = liberado.erro;
    } catch {
      // Rede ou servidor: tenta de novo.
    }
    if (tentativa < TENTATIVAS) await esperar(1500 * tentativa);
  }
  // Não liberou: não deixa o arquivo pesado parado, privado e sem dono.
  await descartarVideoDoDrive(idDoArquivo).catch(() => undefined);
  return { erro: ultimoErro };
}
