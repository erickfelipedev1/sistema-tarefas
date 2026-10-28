"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeVerTudo } from "@/lib/permissions";
import { abrirSessaoDeEnvio, descartarArquivo, driveConfigurado, liberarArquivo, tokenDoDrive } from "@/lib/google-drive";
import { PREFIXO_DO_DRIVE } from "@/lib/anexos";

// Passa pro Google Drive os vídeos que já estão anexados nas tarefas (bucket
// task-attachments do Supabase) e libera o espaço lá. Roda aos poucos, a partir
// da tela /migrar-videos, só pra quem vê tudo. Cada vídeo:
//   1) baixa do Supabase  2) sobe pro Drive e confere o tamanho
//   3) troca o caminho do anexo pra "drive:<código>"  4) apaga o arquivo do Supabase.
// Qualquer falha antes do passo 3 deixa tudo como estava (o que subiu pro Drive
// vai pra lixeira). O anexo continua o mesmo: mesmo nome, mesma tarefa.

const EXTENSOES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
};
const FILTRO_DE_VIDEO = Object.keys(EXTENSOES)
  .map((e) => `file_name.ilike.*.${e}`)
  .join(",");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Cada chamada trabalha até aqui e devolve o placar (a função da Vercel tem limite de tempo).
const TEMPO_POR_CHAMADA_MS = 120_000;

export type ResultadoDaMigracao =
  | { erro: string }
  | {
      migrados: { nome: string; mb: number }[];
      falhas: { id: string; nome: string; motivo: string }[];
      restantes: number;
    };

async function autorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && (await podeVerTudo(supabase, user.id));
}

async function subirParaODrive(
  nome: string,
  tipo: string,
  corpo: Buffer,
  origem: string
): Promise<string> {
  let ultimo = "Falha no envio pro Drive.";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const sessao = await abrirSessaoDeEnvio({ nome, tipoMime: tipo, tamanho: corpo.length, origem });
      const resposta = await fetch(sessao, {
        method: "PUT",
        headers: { "Content-Type": tipo, "Content-Length": String(corpo.length) },
        body: new Uint8Array(corpo),
        cache: "no-store",
      });
      const dados = (await resposta.json().catch(() => ({}))) as { id?: string };
      if ((resposta.status === 200 || resposta.status === 201) && dados.id) return dados.id;
      ultimo = `O Drive respondeu ${resposta.status}.`;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : ultimo;
    }
    await new Promise((r) => setTimeout(r, 1500 * tentativa));
  }
  throw new Error(ultimo);
}

async function tamanhoNoDrive(id: string): Promise<number> {
  const token = await tokenDoDrive();
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=size&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const dados = (await r.json().catch(() => ({}))) as { size?: string };
  return Number(dados.size ?? 0);
}

export async function migrarVideosParaODrive(ignorar: string[] = []): Promise<ResultadoDaMigracao> {
  if (!(await autorizado())) return { erro: "Só quem vê tudo pode rodar esta migração." };
  if (!driveConfigurado()) return { erro: "O Google Drive não está configurado no d.hub." };
  const fora = ignorar.filter((id) => UUID.test(id));

  const cabecalhos = await headers();
  const host = cabecalhos.get("host") ?? "";
  const origem = cabecalhos.get("origin") ?? `https://${host}`;

  const admin = createAdminClient();
  const lista = () => {
    let q = admin
      .from("task_attachments")
      .select("id, file_name, file_path", { count: "exact" })
      .not("file_path", "like", `${PREFIXO_DO_DRIVE}%`)
      .or(FILTRO_DE_VIDEO);
    if (fora.length > 0) q = q.not("id", "in", `(${fora.join(",")})`);
    return q;
  };

  const migrados: { nome: string; mb: number }[] = [];
  const falhas: { id: string; nome: string; motivo: string }[] = [];
  const inicio = Date.now();

  const { data: candidatos, error } = await lista().order("id").limit(40);
  if (error) return { erro: `Não deu pra listar os anexos: ${error.message}` };

  for (const anexo of candidatos ?? []) {
    if (Date.now() - inicio > TEMPO_POR_CHAMADA_MS) break;
    const falhar = (motivo: string) => falhas.push({ id: anexo.id, nome: anexo.file_name, motivo });
    const caminho = anexo.file_path as string;
    const extensao = (anexo.file_name.split(".").pop() ?? "").toLowerCase();
    const tipo = EXTENSOES[extensao] ?? "video/mp4";

    const baixado = await admin.storage.from("task-attachments").download(caminho);
    if (baixado.error || !baixado.data) {
      falhar("Não achei o arquivo no Supabase.");
      continue;
    }
    const corpo = Buffer.from(await baixado.data.arrayBuffer());

    let idDrive: string;
    try {
      idDrive = await subirParaODrive(anexo.file_name, tipo, corpo, origem);
    } catch (e) {
      falhar(e instanceof Error ? e.message : "Falha ao subir pro Drive.");
      continue;
    }

    try {
      // Só segue se o Drive guardou o arquivo inteiro.
      if ((await tamanhoNoDrive(idDrive)) !== corpo.length) throw new Error("O tamanho no Drive não bateu.");
      await liberarArquivo(idDrive, false);
      // Troca o caminho só se o anexo ainda for o mesmo (alguém pode ter mexido).
      const { data: trocado, error: erroTroca } = await admin
        .from("task_attachments")
        .update({ file_path: `${PREFIXO_DO_DRIVE}${idDrive}` })
        .eq("id", anexo.id)
        .eq("file_path", caminho)
        .select("id");
      if (erroTroca || !trocado || trocado.length === 0) throw new Error("O anexo mudou durante a cópia.");
    } catch (e) {
      await descartarArquivo(idDrive, false).catch(() => undefined);
      falhar(e instanceof Error ? e.message : "Falha ao conferir no Drive.");
      continue;
    }

    // Já está no Drive e no banco: agora sim libera o espaço do Supabase.
    await admin.storage.from("task-attachments").remove([caminho]).catch(() => undefined);
    migrados.push({ nome: anexo.file_name, mb: Math.round((corpo.length / 1048576) * 10) / 10 });
  }

  const { count } = await lista().limit(1);
  return { migrados, falhas, restantes: count ?? 0 };
}
