"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarTranscricao, enviarParaTranscrever, ErroDaTranscricao } from "@/lib/assemblyai";
import { ErroDaIA, rascunharAta, rascunhoEmHtml } from "@/lib/ia-atas";
import { BUCKET_DAS_GRAVACOES } from "@/lib/atas";

// Server Actions das atas: transcrever a gravação (AssemblyAI) e rascunhar a
// ata com IA (Claude). Só quem está logado no d.hub usa. As colunas
// transcricao_* só o servidor grava (service role; o gatilho da 0082 barra o
// resto). As chaves dos serviços ficam no servidor.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Transcrição que passou disso sem resposta está travada: libera pra tentar de novo.
const PRAZO_EM_HORAS = 3;
// Marcada "processando" mas sem o pedido registrado (o envio caiu no meio).
const PRAZO_SEM_PEDIDO_EM_MINUTOS = 3;

type Erro = { erro: string };
export type EstadoDaTranscricaoNaTela =
  | { status: "processando" }
  | { status: "pronta"; texto: string }
  | { status: "erro"; erro: string };

async function logado(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

function mensagem(e: unknown, padrao: string): string {
  return e instanceof ErroDaTranscricao || e instanceof ErroDaIA ? e.message : padrao;
}

// Manda a gravação da ata pra transcrever. Uma de cada vez por ata: se já está
// transcrevendo, só devolve o estado.
export async function transcreverAta(ataId: string): Promise<EstadoDaTranscricaoNaTela | Erro> {
  if (!UUID.test(ataId)) return { erro: "Ata inválida." };
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  const { data: ata } = await admin
    .from("atas")
    .select("id, audio_path, transcricao_status, transcricao_em")
    .eq("id", ataId)
    .maybeSingle();
  if (!ata) return { erro: "Ata não encontrada. Salve a ata antes de transcrever." };
  if (!ata.audio_path) return { erro: "Esta ata ainda não tem gravação." };

  const travada =
    ata.transcricao_status === "processando" &&
    (!ata.transcricao_em || Date.now() - new Date(ata.transcricao_em).getTime() > PRAZO_EM_HORAS * 3600_000);
  if (ata.transcricao_status === "processando" && !travada) return { status: "processando" };

  // Marca como "processando" antes de chamar o serviço (um clique duplo não
  // manda a mesma gravação duas vezes).
  const agora = new Date().toISOString();
  let marcar = admin
    .from("atas")
    .update({ transcricao_status: "processando", transcricao_id: null, transcricao_erro: null, transcricao_em: agora })
    .eq("id", ataId);
  marcar = travada
    ? marcar.eq("transcricao_status", "processando")
    : ata.transcricao_status
    ? marcar.eq("transcricao_status", ata.transcricao_status)
    : marcar.is("transcricao_status", null);
  const { data: marcada } = await marcar.select("id").maybeSingle();
  if (!marcada) return { status: "processando" };

  try {
    // Link temporário pro serviço baixar o áudio (vale 6 horas: a fila pode demorar).
    const { data: link, error } = await admin.storage
      .from(BUCKET_DAS_GRAVACOES)
      .createSignedUrl(ata.audio_path, 6 * 3600);
    if (error || !link?.signedUrl) throw new ErroDaTranscricao("Não achei o arquivo da gravação. Grave ou envie de novo.");
    const id = await enviarParaTranscrever(link.signedUrl);
    // Só se a ata ainda está esperando este envio (a gravação pode ter sido trocada no meio).
    await admin
      .from("atas")
      .update({ transcricao_id: id })
      .eq("id", ataId)
      .eq("transcricao_status", "processando")
      .is("transcricao_id", null);
    return { status: "processando" };
  } catch (e) {
    const erro = mensagem(e, "Não deu pra mandar a gravação pra transcrever. Tente de novo.");
    await admin
      .from("atas")
      .update({ transcricao_status: "erro", transcricao_erro: erro.slice(0, 500) })
      .eq("id", ataId);
    return { status: "erro", erro };
  }
}

// Pergunta se a transcrição ficou pronta (a tela chama de tempos em tempos
// enquanto está aberta). Quando fica, grava o texto na ata.
export async function verificarTranscricao(ataId: string): Promise<EstadoDaTranscricaoNaTela | Erro> {
  if (!UUID.test(ataId)) return { erro: "Ata inválida." };
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  const { data: ata } = await admin
    .from("atas")
    .select("transcricao_status, transcricao_id, transcricao_texto, transcricao_erro, transcricao_em")
    .eq("id", ataId)
    .maybeSingle();
  if (!ata) return { erro: "Ata não encontrada." };
  if (ata.transcricao_status === "pronta") return { status: "pronta", texto: ata.transcricao_texto ?? "" };
  if (ata.transcricao_status === "erro") return { status: "erro", erro: ata.transcricao_erro ?? "A transcrição falhou." };
  if (ata.transcricao_status !== "processando") return { erro: "Esta ata não está sendo transcrita." };

  const venceu = !ata.transcricao_em || Date.now() - new Date(ata.transcricao_em).getTime() > PRAZO_EM_HORAS * 3600_000;
  if (!ata.transcricao_id) {
    // Ainda mandando (ou o envio caiu no meio): espera um pouco e libera.
    const semPedidoHaMuito =
      !ata.transcricao_em || Date.now() - new Date(ata.transcricao_em).getTime() > PRAZO_SEM_PEDIDO_EM_MINUTOS * 60_000;
    if (!semPedidoHaMuito) return { status: "processando" };
    const erro = "A transcrição não começou. Tente de novo.";
    await admin.from("atas").update({ transcricao_status: "erro", transcricao_erro: erro }).eq("id", ataId).eq("transcricao_status", "processando");
    return { status: "erro", erro };
  }

  try {
    const estado = await consultarTranscricao(ata.transcricao_id);
    if (estado.status === "pronta") {
      const { error: erroAoGravar } = await admin
        .from("atas")
        .update({
          transcricao_status: "pronta",
          transcricao_texto: estado.texto.slice(0, 800000),
          transcricao_erro: null,
          ...(estado.segundos !== null ? { audio_seconds: estado.segundos } : {}),
        })
        .eq("id", ataId)
        .eq("transcricao_id", ata.transcricao_id);
      // Se não gravou, continua "processando": a próxima pergunta tenta de novo.
      if (erroAoGravar) return { status: "processando" };
      return { status: "pronta", texto: estado.texto };
    }
    if (estado.status === "erro" || venceu) {
      const erro = estado.status === "erro" ? estado.erro : "A transcrição demorou demais. Tente de novo.";
      await admin
        .from("atas")
        .update({ transcricao_status: "erro", transcricao_erro: erro.slice(0, 500) })
        .eq("id", ataId)
        .eq("transcricao_id", ata.transcricao_id);
      return { status: "erro", erro };
    }
    return { status: "processando" };
  } catch (e) {
    // Falha ao perguntar: passageira, continua esperando; passou do prazo, vira erro.
    if (venceu) {
      const erro = mensagem(e, "A transcrição não respondeu a tempo. Tente de novo.");
      await admin
        .from("atas")
        .update({ transcricao_status: "erro", transcricao_erro: erro.slice(0, 500) })
        .eq("id", ataId)
        .eq("transcricao_id", ata.transcricao_id);
      return { status: "erro", erro };
    }
    return e instanceof ErroDaTranscricao && /configurada|chave/i.test(e.message)
      ? { erro: e.message }
      : { status: "processando" };
  }
}

export type RascunhoNaTela = { titulo: string; agenda: string; decisoes: string; proximos: string };

// Rascunha pauta, decisões e próximos passos a partir da transcrição. Não grava
// nada: a tela preenche os campos pra pessoa revisar e salvar.
export async function rascunharAtaComIA(ataId: string): Promise<{ rascunho: RascunhoNaTela } | Erro> {
  if (!UUID.test(ataId)) return { erro: "Ata inválida." };
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  const { data: ata } = await admin
    .from("atas")
    .select("title, project_id, meeting_date, participant_ids, external_participants, transcricao_status, transcricao_texto")
    .eq("id", ataId)
    .maybeSingle();
  if (!ata) return { erro: "Ata não encontrada." };
  if (ata.transcricao_status !== "pronta" || !ata.transcricao_texto?.trim()) {
    return { erro: "A transcrição ainda não está pronta." };
  }
  const ids = (ata.participant_ids as string[] | null) ?? [];
  const [{ data: pessoas }, { data: projeto }] = await Promise.all([
    ids.length > 0
      ? admin.from("profiles").select("name, username").in("id", ids)
      : Promise.resolve({ data: [] as { name: string | null; username: string | null }[] }),
    ata.project_id
      ? admin.from("projects").select("name").eq("id", ata.project_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  try {
    const rascunho = await rascunharAta(ata.transcricao_texto, {
      titulo: ata.title,
      cliente: projeto?.name ?? null,
      data: ata.meeting_date,
      participantes: (pessoas ?? []).map((p) => p.name || p.username || "").filter(Boolean),
      externos: ata.external_participants,
    });
    return { rascunho: rascunhoEmHtml(rascunho) };
  } catch (e) {
    return { erro: mensagem(e, "Não deu pra rascunhar a ata. Tente de novo.") };
  }
}

// Guarda a transcrição feita ao vivo pelo navegador (grátis) na ata, depois que
// a gravação foi salva. As colunas transcricao_* só o servidor grava (0082).
export async function salvarTranscricaoAoVivo(ataId: string, texto: string): Promise<{ ok: true } | Erro> {
  if (!UUID.test(ataId)) return { erro: "Ata inválida." };
  if (typeof texto !== "string" || !texto.trim()) return { erro: "A transcrição ficou vazia." };
  if (!(await logado())) return { erro: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  const { data: ata } = await admin.from("atas").select("audio_path").eq("id", ataId).maybeSingle();
  if (!ata?.audio_path) return { erro: "Salve a gravação antes da transcrição." };
  const { error } = await admin
    .from("atas")
    .update({
      transcricao_status: "pronta",
      transcricao_texto: texto.trim().slice(0, 800000),
      transcricao_id: null,
      transcricao_erro: null,
      transcricao_em: new Date().toISOString(),
    })
    .eq("id", ataId)
    .eq("audio_path", ata.audio_path);
  if (error) return { erro: "Não deu pra salvar a transcrição." };
  return { ok: true };
}
