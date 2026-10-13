// Google Drive — só no servidor. Os vídeos grandes dos posts vão pra uma pasta
// do Drive da conta que autorizou o d.hub (OAuth, com a cota dessa conta).
// Nada daqui vai pro navegador: as chaves ficam em variáveis de ambiente.
//
//   GOOGLE_DRIVE_CLIENT_ID      id da credencial OAuth (Google Cloud)
//   GOOGLE_DRIVE_CLIENT_SECRET  segredo da credencial
//   GOOGLE_DRIVE_REFRESH_TOKEN  token de longa duração da conta dona dos vídeos
//   GOOGLE_DRIVE_FOLDER_ID      (opcional) pasta fixa; sem isso o d.hub cria e
//                               usa a pasta "d.hub - videos dos posts"
//
// O escopo é "drive.file": o d.hub só enxerga os arquivos que ele mesmo criou
// — nunca o resto do seu Drive. Passo a passo em docs/GOOGLE_DRIVE.md.

const URL_DO_TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const NOME_DA_PASTA = "d.hub - videos dos posts";
// Marca gravada em cada arquivo que o d.hub cria: só arquivo com essa marca
// pode ser liberado ou apagado por aqui.
const MARCA = { origem: "dhub-posts" };

let tokenEmCache: { valor: string; expiraEm: number } | null = null;
let pastaEmCache: string | null = null;

export function driveConfigurado(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

// Token de acesso (dura 1h), renovado com o token de longa duração.
export async function tokenDoDrive(): Promise<string> {
  if (tokenEmCache && tokenEmCache.expiraEm > Date.now() + 60_000) return tokenEmCache.valor;
  const resposta = await fetch(URL_DO_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const dados = (await resposta.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!resposta.ok || !dados.access_token) {
    throw new Error(`O Google recusou a autorização do Drive (${dados.error ?? resposta.status}). Gere o token de novo.`);
  }
  tokenEmCache = { valor: dados.access_token, expiraEm: Date.now() + (dados.expires_in ?? 3600) * 1000 };
  return dados.access_token;
}

// A pasta dos vídeos: a fixa (se configurada) ou a que o d.hub cria sozinho.
export async function pastaDosVideos(token: string): Promise<string> {
  const fixa = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (fixa) return fixa;
  if (pastaEmCache) return pastaEmCache;
  const cabecalho = { Authorization: `Bearer ${token}` };
  const consulta = encodeURIComponent(
    `name = '${NOME_DA_PASTA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const lista = await fetch(`${API}/files?q=${consulta}&fields=files(id)&pageSize=1`, {
    headers: cabecalho,
    cache: "no-store",
  });
  if (lista.ok) {
    const { files } = (await lista.json()) as { files?: { id: string }[] };
    if (files?.[0]?.id) return (pastaEmCache = files[0].id);
  }
  const criada = await fetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { ...cabecalho, "Content-Type": "application/json" },
    body: JSON.stringify({ name: NOME_DA_PASTA, mimeType: "application/vnd.google-apps.folder" }),
    cache: "no-store",
  });
  const dados = (await criada.json().catch(() => ({}))) as { id?: string };
  if (!criada.ok || !dados.id) throw new Error("Não deu pra criar a pasta dos vídeos no Drive.");
  return (pastaEmCache = dados.id);
}

// Abre a sessão de envio (resumível). O navegador manda o arquivo direto pro
// Google por essa URL, em pedaços — o arquivo não passa pelo servidor do
// d.hub (a Vercel não aceita corpo grande). "origem" é o endereço do d.hub no
// navegador: o Google só libera o envio direto (CORS) pra essa origem.
export async function abrirSessaoDeEnvio(opcoes: {
  nome: string;
  tipoMime: string;
  tamanho: number;
  origem: string;
}): Promise<string> {
  const token = await tokenDoDrive();
  const abrir = async (pasta: string) =>
    fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opcoes.tipoMime,
        "X-Upload-Content-Length": String(opcoes.tamanho),
        Origin: opcoes.origem,
      },
      body: JSON.stringify({ name: opcoes.nome, parents: [pasta], appProperties: MARCA }),
      cache: "no-store",
    });
  let resposta = await abrir(await pastaDosVideos(token));
  // A pasta guardada na memória pode ter sido apagada ou ido pra lixeira:
  // esquece e procura (ou cria) de novo, uma vez.
  if (resposta.status === 404 && !process.env.GOOGLE_DRIVE_FOLDER_ID) {
    pastaEmCache = null;
    resposta = await abrir(await pastaDosVideos(token));
  }
  const sessao = resposta.headers.get("location");
  if (!resposta.ok || !sessao) {
    throw new Error(`O Drive não abriu o envio (${resposta.status}). Confira a autorização e o espaço da conta.`);
  }
  return sessao;
}

// Só mexe em arquivo que o d.hub criou: tem a marca, é vídeo e não está na
// lixeira. (Com o escopo drive.file o app nem enxerga o resto do Drive; a marca
// é a segunda trava.)
async function conferirArquivoDoDhub(id: string, cabecalho: Record<string, string>) {
  const arquivo = await fetch(
    `${API}/files/${encodeURIComponent(id)}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`,
    { headers: cabecalho, cache: "no-store" }
  );
  const dados = (await arquivo.json().catch(() => ({}))) as {
    mimeType?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
  };
  if (
    !arquivo.ok ||
    dados.trashed ||
    !dados.mimeType?.startsWith("video/") ||
    dados.appProperties?.origem !== MARCA.origem
  ) {
    throw new Error("Esse arquivo não é um vídeo enviado pelo d.hub.");
  }
}

// Joga o vídeo na lixeira do Drive (envio que não chegou a virar post).
export async function descartarArquivo(id: string): Promise<void> {
  const token = await tokenDoDrive();
  const cabecalho = { Authorization: `Bearer ${token}` };
  await conferirArquivoDoDhub(id, cabecalho);
  const resposta = await fetch(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { ...cabecalho, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
    cache: "no-store",
  });
  if (!resposta.ok) throw new Error("Não deu pra descartar o vídeo no Drive.");
}

// Depois do envio: libera pra "qualquer pessoa com o link" poder assistir (o
// preview do post e o portal do cliente tocam sem login).
export async function liberarArquivo(id: string): Promise<void> {
  const token = await tokenDoDrive();
  const cabecalho = { Authorization: `Bearer ${token}` };
  await conferirArquivoDoDhub(id, cabecalho);
  const permissao = await fetch(`${API}/files/${encodeURIComponent(id)}/permissions?supportsAllDrives=true`, {
    method: "POST",
    headers: { ...cabecalho, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
    cache: "no-store",
  });
  if (!permissao.ok) throw new Error("Não deu pra liberar o vídeo no Drive.");
}
