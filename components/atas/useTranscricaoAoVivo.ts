"use client";

import { useEffect, useRef, useState } from "react";

// Transcrição grátis, ao vivo, pelo reconhecimento de voz do próprio navegador
// (Web Speech API: Chrome, Edge e Safari). Roda junto com a gravação: cada
// frase reconhecida vira uma linha "[mm:ss] texto". Não separa quem falou. No
// Chrome o áudio passa pelo Google pra virar texto; no iPhone, pela Apple.
// O Chrome encerra o reconhecimento depois de um silêncio: aqui ele é religado
// sozinho enquanto a gravação está rodando.

interface ResultadoDeFala {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoDeFala {
  resultIndex: number;
  results: ArrayLike<ResultadoDeFala>;
}
interface Reconhecedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoDeFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type Construtor = new () => Reconhecedor;

function construtor(): Construtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function tempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function useTranscricaoAoVivo(segundosAgora: () => number) {
  const [disponivel] = useState(() => construtor() !== null);
  const [linhas, setLinhas] = useState<string[]>([]);
  const [parcial, setParcial] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const reconhecedor = useRef<Reconhecedor | null>(null);
  // Ligado = deve continuar ouvindo (religa quando o navegador encerra sozinho).
  const ligado = useRef(false);
  const desistiu = useRef(false);
  const falas = useRef<string[]>([]);
  const parcialRef = useRef("");
  const aoTerminar = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      ligado.current = false;
      reconhecedor.current?.abort();
    };
  }, []);

  function criar(): Reconhecedor | null {
    const C = construtor();
    if (!C) return null;
    const r = new C();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let provisorio = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const texto = res[0]?.transcript?.trim() ?? "";
        if (!texto) continue;
        if (res.isFinal) falas.current.push(`[${tempo(segundosAgora())}] ${texto}`);
        else provisorio += `${texto} `;
      }
      parcialRef.current = provisorio.trim();
      setParcial(parcialRef.current);
      setLinhas([...falas.current]);
    };
    r.onerror = (e) => {
      // Sem permissão ou sem serviço: a gravação segue, só a transcrição ao vivo para.
      if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(e.error)) {
        desistiu.current = true;
        ligado.current = false;
        setAviso("A transcrição ao vivo não funcionou neste navegador. A gravação continua normalmente.");
      }
    };
    r.onend = () => {
      // O que ainda estava provisório quando parou também entra.
      if (parcialRef.current) {
        falas.current.push(`[${tempo(segundosAgora())}] ${parcialRef.current}`);
        parcialRef.current = "";
        setParcial("");
        setLinhas([...falas.current]);
      }
      if (ligado.current && !desistiu.current) {
        window.setTimeout(() => {
          if (!ligado.current) return;
          try {
            reconhecedor.current?.start();
          } catch {
            /* já estava ligado */
          }
        }, 250);
      } else {
        aoTerminar.current?.();
        aoTerminar.current = null;
      }
    };
    return r;
  }

  function iniciar() {
    falas.current = [];
    parcialRef.current = "";
    desistiu.current = false;
    setLinhas([]);
    setParcial("");
    setAviso(null);
    if (!disponivel) {
      setAviso("Este navegador não transcreve ao vivo (use o Chrome, o Edge ou o Safari). A gravação funciona normalmente.");
      return;
    }
    reconhecedor.current = criar();
    ligado.current = true;
    try {
      reconhecedor.current?.start();
    } catch {
      setAviso("Não deu pra ligar a transcrição ao vivo. A gravação continua normalmente.");
    }
  }

  function pausar() {
    ligado.current = false;
    try {
      reconhecedor.current?.stop();
    } catch {
      /* já parado */
    }
  }

  function retomar() {
    if (!reconhecedor.current || desistiu.current) return;
    ligado.current = true;
    try {
      reconhecedor.current.start();
    } catch {
      /* já ligado */
    }
  }

  // Para de ouvir e devolve o texto todo (espera as últimas frases chegarem,
  // até 2 segundos).
  function encerrar(): Promise<string> {
    return new Promise((resolve) => {
      const fim = () => resolve(falas.current.join("\n"));
      if (!reconhecedor.current || desistiu.current) return fim();
      ligado.current = false;
      const limite = window.setTimeout(() => {
        aoTerminar.current = null;
        fim();
      }, 2000);
      aoTerminar.current = () => {
        window.clearTimeout(limite);
        fim();
      };
      try {
        reconhecedor.current.stop();
      } catch {
        window.clearTimeout(limite);
        fim();
      }
    });
  }

  return { disponivel, linhas, parcial, aviso, iniciar, pausar, retomar, encerrar };
}
