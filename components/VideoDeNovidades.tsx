"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { VIDEO_DE_NOVIDADES, videoDeNovidadesNoAr } from "@/lib/video-de-novidades";
import { XIcon } from "./ui/icons";

// Janela com o vídeo de novidades: abre sozinha uma vez por pessoa (marca em
// avisos_vistos, migration 0134, vale em qualquer aparelho). A marca é
// gravada quando a janela abre, então não volta a aparecer nem se a pessoa
// fechar antes do fim; o vídeo continua em Atualizações.
export default function VideoDeNovidades({ euId }: { euId: string }) {
  const [aberto, setAberto] = useState(false);
  const v = VIDEO_DE_NOVIDADES;
  const chaveLocal = `dhub-aviso-${v.id}`;

  useEffect(() => {
    if (!euId || !videoDeNovidadesNoAr()) return;
    // Atalho deste aparelho: já viu aqui, nem consulta o banco.
    try {
      if (localStorage.getItem(chaveLocal)) return;
    } catch {
      // sem armazenamento local: segue pro banco
    }
    let ativo = true;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("avisos_vistos")
        .select("aviso")
        .eq("profile_id", euId)
        .eq("aviso", v.id)
        .maybeSingle();
      // Sem a tabela (migration 0134) ou sem rede: não abre.
      if (!ativo || error) return;
      if (data) {
        try {
          localStorage.setItem(chaveLocal, "1");
        } catch {}
        return;
      }
      const { error: erroAoMarcar } = await supabase.from("avisos_vistos").insert({ profile_id: euId, aviso: v.id });
      // Erro (inclusive chave repetida: outra aba ou aparelho marcou ao mesmo
      // tempo e já abriu lá): não abre aqui.
      if (!ativo || erroAoMarcar) return;
      try {
        localStorage.setItem(chaveLocal, "1");
      } catch {}
      setAberto(true);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [euId]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={() => setAberto(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={v.titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-dropdown"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{v.titulo}</p>
            <p className="text-xs text-ink-muted">{v.periodo} · o que mudou no d.hub</p>
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <VideoComSom src={v.src} capa={v.capa} />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-ink-muted sm:px-5">
          <span>Pra rever depois, o vídeo fica em Atualizações.</span>
          <Link
            href="/atualizacoes"
            onClick={() => setAberto(false)}
            className="font-semibold text-brand-forte hover:underline"
          >
            Ver todas as atualizações
          </Link>
        </div>
      </div>
    </div>
  );
}

// O vídeo tem música: tenta tocar com som. Se o navegador não deixar (sem
// clique antes na página), toca mudo e mostra o botão de ativar o som.
function VideoComSom({ src, capa }: { src: string; capa: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [mudo, setMudo] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setMudo(true);
      el.play().catch(() => {});
    });
  }, []);

  return (
    <div className="relative">
      <video
        ref={video}
        src={src}
        poster={capa}
        controls
        playsInline
        onVolumeChange={(e) => setMudo(e.currentTarget.muted)}
        className="block aspect-video w-full bg-black"
      />
      {mudo && (
        <button
          type="button"
          onClick={() => {
            const el = video.current;
            if (!el) return;
            el.muted = false;
            el.play().catch(() => {});
          }}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-navy shadow-dropdown hover:bg-brand-hover"
        >
          🔊 Ativar som
        </button>
      )}
    </div>
  );
}

// Cartão do topo de Atualizações: o vídeo de novidades pra rever.
export function CartaoDoVideoDeNovidades() {
  const v = VIDEO_DE_NOVIDADES;
  return (
    <section data-mov="card" className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-ink">Vídeo: {v.titulo.toLowerCase()}</p>
        <p className="text-xs text-ink-muted">{v.periodo}</p>
      </div>
      <video src={v.src} poster={v.capa} controls playsInline preload="none" className="block aspect-video w-full bg-black" />
    </section>
  );
}
