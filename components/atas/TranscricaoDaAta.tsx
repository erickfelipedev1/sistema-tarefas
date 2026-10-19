"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DAS_GRAVACOES, duracaoLegivel } from "@/lib/atas";
import { rascunharAtaComIA, transcreverAta, verificarTranscricao, type RascunhoNaTela } from "@/lib/actions/atas";
import type { Ata } from "@/lib/types";
import { Button } from "../ui/Button";
import { CopyIcon, SparklesIcon } from "../ui/icons";

// O pedido que vai junto com a transcrição quando a pessoa monta a ata no chat
// do Claude (sem a API paga).
const PEDIDO_PRO_CLAUDE = `Abaixo está a transcrição de uma reunião (com o tempo de cada fala). Escreva a ata em português, com frases curtas e objetivas, em três partes:
1. Pauta: os assuntos tratados, na ordem em que apareceram.
2. Decisões: só o que ficou de fato decidido ou aprovado.
3. Próximos passos: as tarefas combinadas, com o responsável e o prazo quando forem ditos.
Não invente nada que não esteja na transcrição.

TRANSCRIÇÃO:`;

type Parte = Pick<Ata, "id" | "audio_path" | "audio_seconds" | "transcricao_status" | "transcricao_texto" | "transcricao_erro">;

// A gravação da ata (pra ouvir) e a transcrição: transcrever, acompanhar
// enquanto o serviço processa (a tela pergunta de tempos em tempos; dá pra
// fechar e voltar depois) e, pronta, ler, copiar e rascunhar a ata com IA.
export default function TranscricaoDaAta({
  ata,
  aoMudar,
  aoRascunho,
  transcricaoPaga,
  iaLigada,
}: {
  ata: Parte;
  aoMudar: (mudancas: Partial<Ata>) => void;
  // Só no formulário: recebe o rascunho da IA pra preencher os campos.
  aoRascunho?: (rascunho: RascunhoNaTela) => void;
  // Os serviços pagos só aparecem quando as chaves estão configuradas.
  transcricaoPaga: boolean;
  iaLigada: boolean;
}) {
  const [urlDoAudio, setUrlDoAudio] = useState("");
  const [ocupado, setOcupado] = useState<"transcrever" | "ia" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  const [copiada, setCopiada] = useState<"texto" | "pedido" | null>(null);
  const status = ata.transcricao_status;

  // Link assinado pra ouvir a gravação.
  useEffect(() => {
    let ativo = true;
    setUrlDoAudio("");
    if (!ata.audio_path) return;
    createClient()
      .storage.from(BUCKET_DAS_GRAVACOES)
      .createSignedUrl(ata.audio_path, 3600)
      .then(({ data }) => {
        if (ativo && data?.signedUrl) setUrlDoAudio(data.signedUrl);
      });
    return () => {
      ativo = false;
    };
  }, [ata.audio_path]);

  // Enquanto transcreve, pergunta a cada 6 s se ficou pronto.
  useEffect(() => {
    if (status !== "processando") return;
    let ativo = true;
    const perguntar = async () => {
      const r = await verificarTranscricao(ata.id);
      if (!ativo) return;
      if (!("status" in r)) {
        // Sessão expirada, ata sumiu, falta configurar: não adianta continuar perguntando.
        setErro(r.erro);
        window.clearInterval(vez);
        return;
      }
      if (r.status === "pronta") aoMudar({ transcricao_status: "pronta", transcricao_texto: r.texto, transcricao_erro: null });
      else if (r.status === "erro") aoMudar({ transcricao_status: "erro", transcricao_erro: r.erro });
    };
    const vez = window.setInterval(perguntar, 6000);
    void perguntar();
    return () => {
      ativo = false;
      window.clearInterval(vez);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ata.id]);

  async function transcrever() {
    setErro(null);
    setOcupado("transcrever");
    const r = await transcreverAta(ata.id);
    setOcupado(null);
    if (!("status" in r)) return setErro(r.erro);
    if (r.status === "erro") aoMudar({ transcricao_status: "erro", transcricao_erro: r.erro });
    else aoMudar({ transcricao_status: "processando", transcricao_erro: null });
  }

  async function rascunhar() {
    if (!aoRascunho) return;
    setErro(null);
    setOcupado("ia");
    const r = await rascunharAtaComIA(ata.id);
    setOcupado(null);
    if ("erro" in r) return setErro(r.erro);
    aoRascunho(r.rascunho);
  }

  // A lista não traz o texto da transcrição (pode ser grande): busca quando precisa.
  async function texto(): Promise<string> {
    if (ata.transcricao_texto) return ata.transcricao_texto;
    const { data } = await createClient().from("atas").select("transcricao_texto").eq("id", ata.id).maybeSingle();
    const t = (data?.transcricao_texto as string | null) ?? "";
    if (t) aoMudar({ transcricao_texto: t });
    return t;
  }

  async function abrirOuFechar() {
    if (!aberta) await texto();
    setAberta((a) => !a);
  }

  // "texto": só a transcrição. "pedido": a transcrição com o pedido pronto pra
  // colar no Claude (chat) e receber a ata, sem pagar API.
  async function copiar(oQue: "texto" | "pedido") {
    try {
      const t = await texto();
      await navigator.clipboard.writeText(oQue === "texto" ? t : `${PEDIDO_PRO_CLAUDE}\n\n${t}`);
      setCopiada(oQue);
      setTimeout(() => setCopiada(null), 2000);
    } catch {
      setErro("Não deu pra copiar. Abra a transcrição e selecione o texto.");
    }
  }

  if (!ata.audio_path) return null;

  return (
    <div className="space-y-2">
      {urlDoAudio && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls preload="none" src={urlDoAudio} className="w-full" />
      )}
      {ata.audio_seconds ? <p className="text-[11px] text-ink-muted">Duração: {duracaoLegivel(ata.audio_seconds)}</p> : null}

      {!status &&
        (transcricaoPaga ? (
          <Button size="sm" variant="secondary" type="button" onClick={transcrever} disabled={ocupado !== null}>
            {ocupado === "transcrever" ? "Enviando..." : "Transcrever a gravação"}
          </Button>
        ) : (
          <p className="text-[11px] text-ink-muted">
            Sem transcrição. A transcrição grátis é feita ao vivo, enquanto você grava pelo d.hub (Chrome, Edge ou Safari).
          </p>
        ))}

      {status === "processando" && (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
          Transcrevendo... Leva alguns minutos (uma reunião de 1 hora, uns 3 a 5). Pode fechar e voltar depois.
        </p>
      )}

      {status === "erro" && (
        <div className="space-y-2">
          <p className="text-xs text-danger">{ata.transcricao_erro ?? "A transcrição falhou."}</p>
          {transcricaoPaga && (
            <Button size="sm" variant="secondary" type="button" onClick={transcrever} disabled={ocupado !== null}>
              {ocupado === "transcrever" ? "Enviando..." : "Tentar transcrever de novo"}
            </Button>
          )}
        </div>
      )}

      {status === "pronta" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={abrirOuFechar}>
              {aberta ? "Esconder a transcrição" : "Ver a transcrição"}
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => copiar("texto")}>
              <CopyIcon className="h-3.5 w-3.5" />
              {copiada === "texto" ? "Copiada ✓" : "Copiar"}
            </Button>
            {!iaLigada && (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => copiar("pedido")}
                title="Copia a transcrição com o pedido da ata, pra colar no Claude (chat)"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                {copiada === "pedido" ? "Copiado: cole no Claude ✓" : "Copiar pra montar a ata no Claude"}
              </Button>
            )}
            {aoRascunho && iaLigada && (
              <Button size="sm" type="button" onClick={rascunhar} disabled={ocupado !== null}>
                <SparklesIcon className="h-3.5 w-3.5" />
                {ocupado === "ia" ? "Escrevendo a ata..." : "Preencher a ata com IA"}
              </Button>
            )}
          </div>
          {ocupado === "ia" && (
            <p className="text-[11px] text-ink-muted">A IA está lendo a transcrição. Pode levar até 1 minuto.</p>
          )}
          {aberta && (
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface p-3 font-sans text-xs leading-relaxed text-ink">
              {ata.transcricao_texto}
            </pre>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
