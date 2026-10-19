"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DAS_GRAVACOES, duracaoLegivel, LIMITE_DA_GRAVACAO_MB } from "@/lib/atas";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/icons";

export interface GravacaoEnviada {
  path: string;
  mime: string;
  size: number;
  segundos: number | null;
}

type Estado = "parado" | "gravando" | "pausado" | "enviando";

// O formato que o navegador sabe gravar: webm/opus (Chrome, Android, Firefox)
// ou mp4/aac (Safari do iPhone e do Mac).
function formatoDeGravacao(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const tipo of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return "";
}

function extensao(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "audio";
}

// Grava a reunião pelo microfone do aparelho (ou recebe um arquivo de áudio já
// gravado) e manda pro bucket da ata. Enquanto grava, a tela fica acesa e o
// navegador avisa antes de sair. Se o envio falhar, a gravação fica na tela pra
// tentar de novo ou baixar: nunca se perde.
export default function GravadorDeReuniao({
  ataId,
  temGravacao,
  aoGravado,
  aoMudarOcupado,
}: {
  ataId: string;
  temGravacao: boolean;
  aoGravado: (gravacao: GravacaoEnviada) => Promise<string | null>;
  // Avisa o formulário enquanto grava/envia (ou há gravação por enviar), pra ele
  // não deixar salvar nem fechar e perder o áudio.
  aoMudarOcupado?: (ocupado: boolean) => void;
}) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ blob: Blob; mime: string; segundos: number | null } | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const microfone = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const relogio = useRef<number | null>(null);
  const telaAcesa = useRef<{ release: () => Promise<void> } | null>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const ocupado = estado !== "parado";

  useEffect(() => {
    aoMudarOcupado?.(ocupado || !!pendente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocupado, pendente]);

  // Avisa antes de sair da página no meio da gravação ou do envio.
  useEffect(() => {
    if (!ocupado && !pendente) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [ocupado, pendente]);

  // Ao sair da tela: solta o microfone e o relógio.
  useEffect(() => {
    return () => {
      if (relogio.current) window.clearInterval(relogio.current);
      microfone.current?.getTracks().forEach((t) => t.stop());
      telaAcesa.current?.release().catch(() => {});
    };
  }, []);

  function ligarRelogio() {
    if (relogio.current) window.clearInterval(relogio.current);
    relogio.current = window.setInterval(() => setSegundos((s) => s + 1), 1000);
  }

  function desligarRelogio() {
    if (relogio.current) window.clearInterval(relogio.current);
    relogio.current = null;
  }

  async function manterTelaAcesa() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      telaAcesa.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      telaAcesa.current = null;
    }
  }

  function podeSubstituir(): boolean {
    return (
      !temGravacao ||
      window.confirm("Esta ata já tem uma gravação. A nova vai substituir a atual e apagar a transcrição dela. Continuar?")
    );
  }

  async function comecar() {
    if (!podeSubstituir()) return;
    setErro(null);
    const mime = formatoDeGravacao();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio. Use o Chrome ou o Safari atualizados, ou envie um arquivo de áudio.");
      return;
    }
    try {
      microfone.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(
        nome === "NotAllowedError"
          ? "O navegador não deixou usar o microfone. Permita o microfone pra este site e tente de novo."
          : nome === "NotFoundError"
          ? "Nenhum microfone encontrado neste aparelho."
          : "Não deu pra ligar o microfone. Tente de novo."
      );
      return;
    }
    pedacos.current = [];
    const r = new MediaRecorder(microfone.current, { mimeType: mime, audioBitsPerSecond: 32000 });
    r.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) pedacos.current.push(ev.data);
    };
    r.onstop = () => {
      microfone.current?.getTracks().forEach((t) => t.stop());
      microfone.current = null;
      telaAcesa.current?.release().catch(() => {});
      telaAcesa.current = null;
      const tipo = (r.mimeType || mime).split(";")[0];
      const blob = new Blob(pedacos.current, { type: tipo });
      pedacos.current = [];
      void enviar(blob, tipo, segundosRef.current);
    };
    gravador.current = r;
    // Um pedaço a cada 5 s (fica na memória desta aba até parar: fechar ou
    // recarregar a aba no meio perde a gravação).
    r.start(5000);
    setSegundos(0);
    setEstado("gravando");
    ligarRelogio();
    void manterTelaAcesa();
  }

  // O relógio do onstop precisa do valor atual (não do de quando começou).
  const segundosRef = useRef(0);
  segundosRef.current = segundos;

  function pausar() {
    if (gravador.current?.state !== "recording") return;
    gravador.current.pause();
    desligarRelogio();
    setEstado("pausado");
  }

  function retomar() {
    if (gravador.current?.state !== "paused") return;
    gravador.current.resume();
    ligarRelogio();
    setEstado("gravando");
  }

  function parar() {
    if (!gravador.current || gravador.current.state === "inactive") return;
    desligarRelogio();
    setEstado("enviando");
    gravador.current.stop();
  }

  async function enviar(blob: Blob, mime: string, duracao: number | null) {
    setEstado("enviando");
    setErro(null);
    if (blob.size === 0) {
      setErro("A gravação ficou vazia. Confira o microfone e grave de novo.");
      setEstado("parado");
      return;
    }
    if (blob.size > LIMITE_DA_GRAVACAO_MB * 1024 * 1024) {
      setPendente({ blob, mime, segundos: duracao });
      setErro(`A gravação passou de ${LIMITE_DA_GRAVACAO_MB} MB e não dá pra enviar. Baixe o arquivo pra não perder.`);
      setEstado("parado");
      return;
    }
    const caminho = `${ataId}/${Date.now()}-gravacao.${extensao(mime)}`;
    const { error } = await createClient()
      .storage.from(BUCKET_DAS_GRAVACOES)
      .upload(caminho, blob, { contentType: mime || "audio/webm" });
    if (error) {
      setPendente({ blob, mime, segundos: duracao });
      setErro(
        /bucket|not found/i.test(error.message)
          ? "As gravações ainda não estão liberadas no banco (migration 0082). Baixe o arquivo pra não perder."
          : "Não deu pra enviar a gravação. Tente de novo (ou baixe o arquivo pra não perder)."
      );
      setEstado("parado");
      return;
    }
    const falha = await aoGravado({ path: caminho, mime, size: blob.size, segundos: duracao });
    if (falha) {
      setPendente({ blob, mime, segundos: duracao });
      setErro(falha);
    } else {
      setPendente(null);
    }
    setEstado("parado");
  }

  function baixarPendente() {
    if (!pendente) return;
    const href = URL.createObjectURL(pendente.blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `gravacao-da-reuniao.${extensao(pendente.mime)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  function escolherArquivo(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (seletor.current) seletor.current.value = "";
    if (!arquivo) return;
    if (!podeSubstituir()) return;
    if (!/^(audio|video)\//.test(arquivo.type) && !/\.(m4a|mp3|wav|ogg|opus|webm|aac|mp4)$/i.test(arquivo.name)) {
      setErro("Escolha um arquivo de áudio (m4a, mp3, wav, ogg, webm).");
      return;
    }
    const mime = arquivo.type || `audio/${extensao(arquivo.name.split(".").pop() ?? "")}`;
    void enviar(arquivo, mime.startsWith("video/") ? mime.replace("video/", "audio/") : mime, null);
  }

  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      {estado === "parado" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" type="button" onClick={comecar}>
            <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden="true" />
            {temGravacao ? "Gravar de novo" : "Gravar a reunião"}
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={() => seletor.current?.click()}>
            Enviar arquivo de áudio
          </Button>
          <input
            ref={seletor}
            type="file"
            accept="audio/*,video/webm,video/mp4,.m4a,.mp3,.wav,.ogg,.opus,.webm"
            onChange={(e) => escolherArquivo(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {(estado === "gravando" || estado === "pausado") && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-ink" role="status" aria-live="polite">
            <span
              className={`h-3 w-3 rounded-full bg-danger ${estado === "gravando" ? "animate-pulse" : "opacity-40"}`}
              aria-hidden="true"
            />
            {estado === "gravando" ? "Gravando" : "Pausado"} · {duracaoLegivel(segundos) || "0s"}
          </span>
          <div className="flex flex-wrap gap-2">
            {estado === "gravando" ? (
              <Button size="sm" variant="secondary" type="button" onClick={pausar}>
                Pausar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" type="button" onClick={retomar}>
                Continuar
              </Button>
            )}
            <Button size="sm" type="button" onClick={parar}>
              Parar e salvar
            </Button>
          </div>
          <p className="w-full text-[11px] text-ink-muted">
            Deixe esta tela aberta até terminar (fechar ou recarregar perde a gravação). Numa reunião online, use o alto-falante (sem fone) pra gravação pegar
            todo mundo.
          </p>
        </div>
      )}

      {estado === "enviando" && <p className="text-sm text-ink-muted">Enviando a gravação...</p>}

      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
      {pendente && estado === "parado" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendente.blob.size <= LIMITE_DA_GRAVACAO_MB * 1024 * 1024 && (
            <Button size="sm" type="button" onClick={() => void enviar(pendente.blob, pendente.mime, pendente.segundos)}>
              Tentar enviar de novo
            </Button>
          )}
          <Button size="sm" variant="secondary" type="button" onClick={baixarPendente}>
            <DownloadIcon className="h-3.5 w-3.5" />
            Baixar a gravação
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              if (window.confirm("Descartar esta gravação? Se não baixou, ela se perde.")) {
                setPendente(null);
                setErro(null);
              }
            }}
          >
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
