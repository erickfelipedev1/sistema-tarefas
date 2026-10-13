"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";
import { BUCKET_DOS_POSTS, capaValida, ehDoDrive, midiasValidas } from "@/lib/posts";
import { formatarDataBR } from "@/lib/format";
import { Button } from "../ui/Button";
import CalendarioDePostagem, { intervaloDaGrade, type PostNoCalendario } from "./CalendarioDePostagem";

function arrumar(post: Post, nomes: Map<string, string>): PostNoCalendario {
  return {
    ...post,
    media: midiasValidas(post.media),
    cover: capaValida(post.cover),
    networks: Array.isArray(post.networks) ? post.networks : [],
    projectName: nomes.get(post.project_id) ?? "Cliente",
  };
}

// Tela "Calendário de postagem": os posts de todos os clientes por data
// prevista. Clicar num post leva pra aba Posts do cliente, já com ele aberto;
// clicar num dia vazio pergunta de qual cliente é o post novo; arrastar muda a
// data prevista.
export default function PostagensView({
  postsIniciais,
  clientes,
}: {
  postsIniciais: Post[];
  clientes: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const nomes = useMemo(() => new Map(clientes.map((c) => [c.id, c.name])), [clientes]);
  const [posts, setPosts] = useState<PostNoCalendario[]>(() => postsIniciais.map((p) => arrumar(p, nomes)));
  const [links, setLinks] = useState<Record<string, string>>({});
  const [diaNovo, setDiaNovo] = useState<string | null>(null);
  const [clienteDoNovo, setClienteDoNovo] = useState("");
  const [mesNaTela, setMesNaTela] = useState(() => {
    const h = new Date();
    return { ano: h.getFullYear(), mes: h.getMonth() };
  });

  // Tempo real: post criado, mudado ou apagado por outra pessoa.
  useEffect(() => {
    const canal = supabase
      .channel("postagens-calendario")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        setPosts((atual) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            return atual.filter((p) => p.id !== id);
          }
          const novo = payload.new as Post;
          if (payload.eventType === "INSERT") {
            return atual.some((p) => p.id === novo.id) ? atual : [...atual, arrumar(novo, nomes)];
          }
          // UPDATE: o Realtime pode mandar só as colunas que mudaram.
          return atual.map((p) => (p.id === novo.id ? arrumar({ ...p, ...novo }, nomes) : p));
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capas só do mês na tela (e dos sem data): o bucket é privado e não vale
  // assinar milhares de arquivos de uma vez.
  const caminhos = useMemo(() => {
    const { de, ate } = intervaloDaGrade(mesNaTela.ano, mesNaTela.mes);
    return posts
      .filter((p) => !p.scheduled_date || (p.scheduled_date >= de && p.scheduled_date <= ate))
      .map((p) => {
        const mini = p.cover ?? p.media[0];
        return mini && !ehDoDrive(mini) ? mini.path : undefined;
      })
      .filter((c): c is string => !!c);
  }, [posts, mesNaTela]);
  const linksRef = useRef(links);
  linksRef.current = links;
  useEffect(() => {
    const faltam = Array.from(new Set(caminhos.filter((c) => !(c in linksRef.current))));
    if (faltam.length === 0) return;
    let ativo = true;
    supabase.storage
      .from(BUCKET_DOS_POSTS)
      .createSignedUrls(faltam, 3600)
      .then(({ data, error }) => {
        if (!ativo || error || !data) return;
        const novos: Record<string, string> = {};
        for (const c of faltam) novos[c] = "";
        for (const a of data) if (a.path && a.signedUrl) novos[a.path] = a.signedUrl;
        setLinks((atual) => ({ ...atual, ...novos }));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminhos]);

  const moverData = useCallback(
    async (post: PostNoCalendario, novaData: string) => {
      const antes = post.scheduled_date;
      setPosts((atual) => atual.map((p) => (p.id === post.id ? { ...p, scheduled_date: novaData } : p)));
      const { data, error } = await supabase
        .from("posts")
        .update({ scheduled_date: novaData })
        .eq("id", post.id)
        .select("id");
      if (error || !data || data.length === 0) {
        setPosts((atual) => atual.map((p) => (p.id === post.id ? { ...p, scheduled_date: antes } : p)));
        return "Não foi possível mudar a data do post. Tente de novo.";
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div>
      <CalendarioDePostagem
        posts={posts}
        links={links}
        mostrarCliente
        clientes={clientes}
        aoAbrir={(p) => router.push(`/projetos/${p.project_id}?aba=posts&post=${p.id}`)}
        aoMoverData={moverData}
        aoNovo={(dia) => {
          setClienteDoNovo("");
          setDiaNovo(dia);
        }}
        aoMudarMes={(ano, mes) => setMesNaTela((a) => (a.ano === ano && a.mes === mes ? a : { ano, mes }))}
      />

      {diaNovo && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4"
          onClick={() => setDiaNovo(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label="Novo post"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-dropdown"
          >
            <p className="text-sm font-semibold text-ink">Novo post em {formatarDataBR(diaNovo)}</p>
            <p className="mt-1 text-xs text-ink-muted">De qual cliente é o post?</p>
            <select
              value={clienteDoNovo}
              onChange={(e) => setClienteDoNovo(e.target.value)}
              aria-label="Cliente do post"
              autoFocus
              className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              <option value="">Escolha o cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDiaNovo(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!clienteDoNovo}
                onClick={() => router.push(`/projetos/${clienteDoNovo}?aba=posts&novo=${diaNovo}`)}
              >
                Criar post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
