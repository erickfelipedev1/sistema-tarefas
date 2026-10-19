"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { categoriaVaiProInstagram } from "@/lib/instagram-regras";
import { iniciarPublicacaoNoInstagram, verificarPublicacaoNoInstagram } from "@/lib/actions/instagram";
import { Button } from "../ui/Button";

const A_CADA = 4000; // ms entre uma conferência e outra
const DESISTE_DEPOIS = 8 * 60_000; // ms

// "Publicar no Instagram" no post aberto da aba Posts do cliente: confirma,
// manda pra Meta, acompanha o processamento (vídeo leva alguns minutos) e
// mostra o link do post no ar. Depois de publicado o botão some.
export default function PublicarNoInstagram({
  post,
  instagramLigado,
  usuario,
  nota,
  aoMudar,
}: {
  post: Post;
  // @usuario da conta ligada ao cliente (ou "" se ligada sem nome); null = não ligada.
  instagramLigado: string | null;
  usuario?: string;
  // Aviso curto embaixo do botão (ex.: "publica o que está salvo").
  nota?: string;
  aoMudar: (mudancas: Partial<Post>) => void;
}) {
  const [trabalhando, setTrabalhando] = useState(post.ig_estado === "preparando" || post.ig_estado === "publicando");
  const [erro, setErro] = useState<string | null>(post.ig_estado === "erro" ? post.ig_erro ?? "A publicação falhou." : null);
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comecou = useRef(0);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const conferir = useCallback(async () => {
    let r: Awaited<ReturnType<typeof verificarPublicacaoNoInstagram>>;
    try {
      r = await verificarPublicacaoNoInstagram(post.id);
    } catch {
      // Falha passageira (rede, deploy novo): tenta de novo, até o limite de tempo.
      if (!ativo.current) return;
      if (Date.now() - comecou.current > DESISTE_DEPOIS) {
        setTrabalhando(false);
        setAviso("Perdi a conexão com o servidor. Recarregue a página: se o post estiver em andamento, ela volta a acompanhar.");
        return;
      }
      temporizador.current = setTimeout(conferir, A_CADA);
      return;
    }
    if (!ativo.current) return;
    if (!("estado" in r)) {
      setTrabalhando(false);
      setErro(r.erro);
      return;
    }
    if (r.estado === "publicado") {
      setTrabalhando(false);
      setErro(null);
      aoMudar({
        status: "publicado",
        ig_estado: "publicado",
        ig_media_id: r.mediaId,
        ig_permalink: r.permalink,
        ig_erro: null,
      });
      return;
    }
    if (r.estado === "erro") {
      setTrabalhando(false);
      setErro(r.erro);
      aoMudar({ ig_estado: "erro", ig_erro: r.erro });
      return;
    }
    if (Date.now() - comecou.current > DESISTE_DEPOIS) {
      setTrabalhando(false);
      setAviso("O Instagram ainda está processando. Abra o post de novo em alguns minutos pra ver se saiu.");
      return;
    }
    temporizador.current = setTimeout(conferir, A_CADA);
  }, [post.id, aoMudar]);

  // Já estava em andamento (outra aba, ou a página foi recarregada): continua acompanhando.
  useEffect(() => {
    if (post.ig_estado === "preparando" || post.ig_estado === "publicando") {
      comecou.current = Date.now();
      temporizador.current = setTimeout(conferir, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!post.networks.includes("instagram") || !categoriaVaiProInstagram(post.category)) return null;

  if (post.ig_estado === "publicado") {
    return (
      <div className="mt-4 rounded-xl border border-success/30 bg-success-light p-3 text-sm text-success">
        <p className="font-medium">Publicado no Instagram ✓</p>
        {post.ig_permalink && (
          <a
            href={post.ig_permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-medium underline underline-offset-2"
          >
            Ver o post no Instagram
          </a>
        )}
      </div>
    );
  }

  async function publicar() {
    if (trabalhando) return;
    const conta = usuario ? `@${usuario}` : "o Instagram do cliente";
    const ok = window.confirm(
      `Publicar este post agora em ${conta}? Ele vai ao ar na hora e não dá pra desfazer por aqui.${
        post.status === "rascunho" ? "\n\nAtenção: o post ainda é um rascunho e o cliente não aprovou." : ""
      }`
    );
    if (!ok) return;
    setErro(null);
    setAviso(null);
    setTrabalhando(true);
    comecou.current = Date.now();
    let r: Awaited<ReturnType<typeof iniciarPublicacaoNoInstagram>>;
    try {
      r = await iniciarPublicacaoNoInstagram(post.id);
    } catch {
      if (!ativo.current) return;
      setTrabalhando(false);
      setErro("Não deu pra confirmar o envio. Recarregue a página: se o post estiver em andamento, ela volta a acompanhar.");
      return;
    }
    if (!ativo.current) return;
    if (!("estado" in r) || r.estado === "erro") {
      setTrabalhando(false);
      setErro(r.erro);
      return;
    }
    aoMudar({ ig_estado: "preparando", ig_erro: null });
    temporizador.current = setTimeout(conferir, 2500);
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-canvas p-3">
      <p className="text-xs font-medium text-ink">Instagram</p>
      {instagramLigado === null ? (
        <p className="mt-1 text-xs text-ink-muted">
          Este cliente ainda não tem o Instagram ligado. Use o botão <b>Instagram</b> no topo da página do cliente.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={publicar} disabled={trabalhando}>
              {trabalhando ? "Enviando pro Instagram..." : "Publicar no Instagram"}
            </Button>
            {instagramLigado && <span className="text-xs text-ink-muted">em @{instagramLigado}</span>}
          </div>
          {nota && !trabalhando && <p className="mt-2 text-[11px] text-ink-muted">{nota}</p>}
          {trabalhando && (
            <p className="mt-2 text-xs text-ink-muted">
              A Meta está processando os arquivos (vídeo pode levar alguns minutos). Deixe este post aberto até terminar: é
              esta tela que confere e publica.
            </p>
          )}
        </>
      )}
      {aviso && <p className="mt-2 text-xs text-ink-muted">{aviso}</p>}
      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
    </div>
  );
}
