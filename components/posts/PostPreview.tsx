"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PostCategory, PostNetwork } from "@/lib/types";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  ImageIcon,
  MessageCircleIcon,
  MoreVerticalIcon,
  SendIcon,
  ShareIcon,
  ThumbsUpIcon,
} from "../ui/icons";

export interface MidiaDoPreview {
  url: string; // vazio = o arquivo não pôde ser aberto
  tipo: "image" | "video";
}

// Como o post vai aparecer em cada rede: a mesma legenda e os mesmos
// arquivos, na ordem e no arranjo de cada uma (legenda embaixo no Instagram,
// em cima no Facebook e no LinkedIn, por cima do vídeo no TikTok). É um
// esboço fiel ao formato — não copia marca, cor nem logotipo de rede nenhuma,
// usa as cores do d.hub. Serve igual pra equipe (enquanto monta o post) e pro
// cliente (no portal).
export default function PostPreview({
  rede,
  categoria,
  legenda,
  midias,
  conta,
  data,
}: {
  rede: PostNetwork;
  categoria: PostCategory;
  legenda: string;
  midias: MidiaDoPreview[];
  conta: string;
  data: string | null; // já formatada ("12/10/2026")
}) {
  const quando = data ? `Previsto para ${data}` : "Data a definir";
  const proporcao = categoria === "reel" ? "aspect-[9/16]" : categoria === "carrossel" ? "aspect-[4/5]" : null;

  if (rede === "tiktok") {
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-line bg-black text-white">
        <Midias midias={midias} preencher />
        {/* Tudo que fica por cima do vídeo deixa o clique passar pros controles. */}
        <div className="pointer-events-none absolute bottom-24 right-2.5 flex flex-col items-center gap-4">
          <Inicial conta={conta} className="h-9 w-9 border border-white/70 bg-white/20 text-white" />
          <HeartIcon className="h-6 w-6" />
          <MessageCircleIcon className="h-6 w-6" />
          <ShareIcon className="h-6 w-6" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3.5 pb-14 pt-10">
          <p className="text-sm font-semibold">@{conta}</p>
          <Legenda texto={legenda} className="mt-1 text-[13px] text-white/90" linhas="line-clamp-2" clicavel />
          <p className="mt-1.5 text-[11px] text-white/60">{quando}</p>
        </div>
      </div>
    );
  }

  if (rede === "instagram") {
    return (
      <Moldura>
        <Topo conta={conta} />
        <Midias midias={midias} proporcao={proporcao} />
        <div className="flex items-center gap-3.5 px-3.5 pt-3 text-ink">
          <HeartIcon className="h-5 w-5" />
          <MessageCircleIcon className="h-5 w-5" />
          <SendIcon className="h-5 w-5" />
          <BookmarkIcon className="ml-auto h-5 w-5" />
        </div>
        <Legenda texto={legenda} conta={conta} className="px-3.5 pt-2 text-sm text-ink" />
        <p className="px-3.5 pb-3.5 pt-1.5 text-[11px] text-ink-muted">{quando}</p>
      </Moldura>
    );
  }

  // Facebook e LinkedIn: legenda em cima da mídia, barra de reações embaixo.
  const acoes =
    rede === "facebook"
      ? [
          { rotulo: "Curtir", icone: ThumbsUpIcon },
          { rotulo: "Comentar", icone: MessageCircleIcon },
          { rotulo: "Compartilhar", icone: ShareIcon },
        ]
      : [
          { rotulo: "Gostei", icone: ThumbsUpIcon },
          { rotulo: "Comentar", icone: MessageCircleIcon },
          { rotulo: "Compartilhar", icone: ShareIcon },
          { rotulo: "Enviar", icone: SendIcon },
        ];
  return (
    <Moldura>
      <Topo
        conta={conta}
        apoio={rede === "facebook" ? `${quando} · Público` : `Página da empresa · ${quando}`}
        quadrado={rede === "linkedin"}
      />
      <Legenda texto={legenda} className="px-3.5 pb-3 text-sm text-ink" />
      <Midias midias={midias} proporcao={proporcao} />
      <div className="flex items-center justify-around border-t border-line px-2 py-2.5 text-ink-muted">
        {acoes.map(({ rotulo, icone: Icone }) => (
          <span key={rotulo} className="flex items-center gap-1 text-[11px] font-medium">
            <Icone className="h-4 w-4" />
            {rotulo}
          </span>
        ))}
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
  );
}

function Inicial({ conta, className = "" }: { conta: string; className?: string }) {
  return (
    <span className={`grid flex-shrink-0 place-items-center rounded-full text-xs font-semibold ${className}`}>
      {(conta.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function Topo({ conta, apoio, quadrado }: { conta: string; apoio?: string; quadrado?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3">
      <Inicial conta={conta} className={`h-9 w-9 bg-avatar text-white ${quadrado ? "!rounded-lg" : ""}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{conta}</p>
        {apoio && <p className="truncate text-[11px] text-ink-muted">{apoio}</p>}
      </div>
      <MoreVerticalIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
    </div>
  );
}

// A legenda corta em poucas linhas, como nas redes, e abre inteira no "mais"
// — quem aprova precisa conseguir ler tudo.
function Legenda({
  texto,
  conta,
  className = "",
  linhas = "line-clamp-3",
  clicavel,
}: {
  texto: string;
  conta?: string;
  className?: string;
  linhas?: string;
  clicavel?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const limpo = texto.trim();
  if (!limpo) return <p className={`${className} italic opacity-60`}>Sem legenda.</p>;
  const longa = limpo.length > 110 || limpo.split("\n").length > 3;
  return (
    <div className={className}>
      <p className={`whitespace-pre-wrap break-words ${aberta ? "" : linhas}`}>
        {conta && <span className="font-semibold">{conta} </span>}
        {limpo}
      </p>
      {longa && (
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          className={`mt-0.5 text-xs font-medium opacity-70 hover:opacity-100 ${clicavel ? "pointer-events-auto" : ""}`}
        >
          {aberta ? "menos" : "mais"}
        </button>
      )}
    </div>
  );
}

// Os arquivos do post. Um só: aparece inteiro. Vários: carrossel de arrastar,
// com setas, bolinhas e o contador. Nada é cortado (object-contain) — o
// cliente precisa ver a arte toda, mesmo que a rede vá cortar um pouco.
function Midias({
  midias,
  proporcao = null,
  preencher,
}: {
  midias: MidiaDoPreview[];
  proporcao?: string | null;
  preencher?: boolean;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const varias = midias.length > 1;

  // Tirar um arquivo não deixa o contador num slide que não existe mais.
  useEffect(() => {
    setIndice((i) => Math.min(i, Math.max(0, midias.length - 1)));
  }, [midias.length]);

  function ir(para: number) {
    const el = trilho.current;
    if (!el) return;
    const alvo = Math.min(midias.length - 1, Math.max(0, para));
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: alvo * el.clientWidth, behavior: calmo ? "auto" : "smooth" });
  }

  const caixa = preencher ? "absolute inset-0" : `relative ${proporcao ?? ""}`;

  if (midias.length === 0) {
    return (
      <div className={`${preencher ? "absolute inset-0" : `relative ${proporcao ?? "aspect-[4/5]"}`} grid place-items-center bg-canvas text-ink-muted`}>
        <span className="flex flex-col items-center gap-2 text-xs">
          <ImageIcon className="h-7 w-7" />
          Sem mídia ainda
        </span>
      </div>
    );
  }

  // Uma imagem só, fora do TikTok: altura natural, sem moldura de proporção.
  if (!varias && !preencher && !proporcao) {
    return (
      <div className="relative bg-black">
        <Arquivo midia={midias[0]} className="max-h-[520px] w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`${caixa} bg-black`}>
      <div
        ref={trilho}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setIndice(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {midias.map((midia, i) => (
          <div key={`${midia.url}-${i}`} className="h-full w-full flex-shrink-0 snap-center">
            <Arquivo midia={midia} className="h-full w-full object-contain" />
          </div>
        ))}
      </div>

      {varias && (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {indice + 1}/{midias.length}
          </span>
          {indice > 0 && (
            <BotaoDoCarrossel lado="left-2" rotulo="Anterior" onClick={() => ir(indice - 1)}>
              <ChevronLeftIcon className="h-4 w-4" />
            </BotaoDoCarrossel>
          )}
          {indice < midias.length - 1 && (
            <BotaoDoCarrossel lado="right-2" rotulo="Próximo" onClick={() => ir(indice + 1)}>
              <ChevronRightIcon className="h-4 w-4" />
            </BotaoDoCarrossel>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1">
            {midias.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === indice ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BotaoDoCarrossel({
  lado,
  rotulo,
  onClick,
  children,
}: {
  lado: string;
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={`absolute top-1/2 ${lado} grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80`}
    >
      {children}
    </button>
  );
}

function Arquivo({ midia, className }: { midia: MidiaDoPreview; className: string }) {
  if (!midia.url) {
    return (
      <div className="grid h-full min-h-[200px] w-full place-items-center px-6 text-center text-xs text-white/70">
        Não deu pra abrir este arquivo. Recarregue a página.
      </div>
    );
  }
  if (midia.tipo === "video") {
    return <video src={midia.url} controls playsInline preload="metadata" className={`block ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={midia.url} alt="" loading="lazy" className={`block ${className}`} />;
}
