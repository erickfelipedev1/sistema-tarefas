"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { pt } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { createClient } from "@/lib/supabase/client";
import { formatarRelativo } from "@/lib/format";
import type { Page } from "@/lib/types";
import { paletaDaPagina } from "@/lib/wiki-paletas";
import SeletorDePaleta from "@/components/SeletorDePaleta";
import BotaoDeCoresDoEditor from "@/components/BotaoDeCoresDoEditor";
import CompartilharPagina from "@/components/CompartilharPagina";
import { esquemaDaWiki } from "@/lib/wiki-esquema";

// A página tem uma paleta (migrations 0125/0126, lib/wiki-paletas.ts), igual
// pra todo mundo que abre: a cor da folha, a da letra e o tema do editor.
//
// Página compartilhada (migration 0133): mais de uma pessoa pode editar. Cada
// gravação só vale se a página ainda está na versão que este editor conhece
// (updated_at); se outra pessoa salvou antes, avisa em vez de apagar o que
// ela escreveu. Quando a página muda e aqui não há nada por salvar, o editor
// já mostra a versão nova.

type Problema = "conflito" | "so-leitura" | "sem-acesso" | "erro" | null;

function mesmoInstante(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

export default function PageEditor({
  page,
  somenteLeitura = false,
  compartilhar = null,
}: {
  page: Page;
  // Compartilhada comigo com "só ver" (migration 0133).
  somenteLeitura?: boolean;
  // Quem criou a página pessoal: botão de compartilhar.
  compartilhar?: { euId: string; quantas: number } | null;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(page.title);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [updatedAt, setUpdatedAt] = useState(page.updated_at);
  const [htmlParaImprimir, setHtmlParaImprimir] = useState("");
  const [fundo, setFundo] = useState<string | null>(paletaDaPagina(page.cor_fundo)?.codigo ?? null);
  const [erroDoFundo, setErroDoFundo] = useState<string | null>(null);
  const [problema, setProblema] = useState<Problema>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Versão da página que este editor conhece (o updated_at da última leitura
  // ou da última gravação daqui).
  const versao = useRef(page.updated_at);
  // Há mudança daqui esperando pra ser gravada (ou sendo gravada).
  const pendente = useRef(false);
  // Conta as mudanças daqui: a gravação só limpa "pendente" se nada mudou
  // enquanto ela ia pro banco.
  const edicoes = useRef(0);
  // updated_at das gravações feitas daqui: o aviso em tempo real delas não é
  // "outra pessoa salvou".
  const minhasGravacoes = useRef<Set<number>>(new Set());
  // O editor está trocando o conteúdo pela versão de outra pessoa: não é
  // mudança daqui, não grava.
  const aplicandoRemoto = useRef(false);
  const tituloAtual = useRef(page.title);
  const estilo = paletaDaPagina(fundo);

  async function mudarFundo(valor: string | null) {
    if (valor === fundo) return;
    const antes = fundo;
    setFundo(valor);
    setErroDoFundo(null);
    const { data, error } = await supabase.from("pages").update({ cor_fundo: valor }).eq("id", page.id).select("id");
    if (error || !data || data.length === 0) {
      setFundo(antes);
      setErroDoFundo("Não deu pra trocar o fundo. Tente de novo.");
    }
  }

  const initialContent =
    Array.isArray(page.content) && (page.content as unknown[]).length > 0
      ? (page.content as never)
      : undefined;

  const editor = useCreateBlockNote({
    // Cor da letra e marca-texto aceitam a paleta grande (lib/wiki-esquema.ts).
    schema: esquemaDaWiki,
    initialContent,
    // Menus do editor em português (o botão "Cores" é o de cor de letra e marca-texto).
    dictionary: pt,
  });

  // Exportar PDF: monta uma versão limpa (tema claro, só título e conteúdo) que
  // só existe no papel (.so-imprime) e abre a impressão do navegador, onde se
  // escolhe "Salvar como PDF". O título da aba vira o nome do arquivo.
  async function exportarPdf() {
    // U+FFFC ("caractere de objeto", que sobra de colagens de outros apps) sai
    // no papel como uma caixinha "OBJ"; some do PDF.
    const html = (await editor.blocksToHTMLLossy(editor.document)).replace(/￼/g, "");
    setHtmlParaImprimir(html);
    const tituloAnterior = document.title;
    document.title = (title.trim() || "Sem título").replace(/[\/:*?"<>|]/g, "-");
    const restaurar = () => {
      document.title = tituloAnterior;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    // Espera o React pintar o HTML antes de imprimir.
    setTimeout(() => window.print(), 150);
  }

  // Grava título e conteúdo. Sem "porCima", só grava se ninguém salvou a
  // página depois da versão que este editor conhece.
  async function gravar(nextTitle: string, porCima = false) {
    const agora = new Date().toISOString();
    const edicaoGravada = edicoes.current;
    minhasGravacoes.current.add(new Date(agora).getTime());
    let consulta = supabase
      .from("pages")
      .update({
        title: nextTitle.trim() || "Sem título",
        content: editor.document,
        updated_at: agora,
      })
      .eq("id", page.id);
    if (!porCima) consulta = consulta.eq("updated_at", versao.current);
    const { data, error } = await consulta.select("id");
    if (error) {
      setStatus("idle");
      setProblema("erro");
      return;
    }
    if (!data || data.length === 0) {
      // Não gravou: ou a página mudou, ou não posso editar, ou perdi o acesso.
      const { data: atual } = await supabase.from("pages").select("updated_at").eq("id", page.id).maybeSingle();
      setStatus("idle");
      setProblema(!atual ? "sem-acesso" : mesmoInstante(atual.updated_at as string, versao.current) ? "so-leitura" : "conflito");
      return;
    }
    versao.current = agora;
    // Mudou mais coisa enquanto gravava: continua pendente (o próximo
    // salvamento já está agendado).
    if (edicoes.current === edicaoGravada) pendente.current = false;
    setProblema(null);
    setUpdatedAt(agora);
    setStatus(pendente.current ? "saving" : "saved");
  }

  function scheduleSave(nextTitle: string) {
    if (somenteLeitura || aplicandoRemoto.current) return;
    tituloAtual.current = nextTitle;
    edicoes.current += 1;
    pendente.current = true;
    setStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => gravar(nextTitle), 800);
  }

  // Outra pessoa salvou: sem nada por gravar aqui, o editor passa pra versão
  // nova; com algo por gravar, avisa (a gravação daqui seria recusada).
  useEffect(() => {
    const canal = supabase
      .channel(`pagina-${page.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pages", filter: `id=eq.${page.id}` },
        async (payload) => {
          const novo = payload.new as Partial<Page>;
          if (!novo.updated_at || mesmoInstante(novo.updated_at, versao.current)) return;
          // Aviso da minha própria gravação (pode chegar antes da resposta dela).
          if (minhasGravacoes.current.has(new Date(novo.updated_at).getTime())) return;
          if (pendente.current) {
            setProblema("conflito");
            return;
          }
          const { data } = await supabase
            .from("pages")
            .select("title, content, updated_at")
            .eq("id", page.id)
            .maybeSingle();
          if (!data || pendente.current) return;
          const conteudo = Array.isArray(data.content) && data.content.length > 0 ? data.content : [{ type: "paragraph" }];
          aplicandoRemoto.current = true;
          try {
            editor.replaceBlocks(editor.document, conteudo as never);
          } finally {
            setTimeout(() => {
              aplicandoRemoto.current = false;
            }, 0);
          }
          versao.current = data.updated_at as string;
          tituloAtual.current = data.title as string;
          setTitle(data.title as string);
          setUpdatedAt(data.updated_at as string);
          setProblema(null);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  return (
    <div>
      <div className="nao-imprime">
      <input
        value={title}
        readOnly={somenteLeitura}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder="Título da página"
        className="w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-ink placeholder:text-ink-muted focus:outline-none sm:text-4xl"
      />

      <div className="mb-6 mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {page.created_by_label && <span>por {page.created_by_label}</span>}
        {page.created_by_label && <span className="text-ink-muted">·</span>}
        <span>Atualizado {formatarRelativo(updatedAt)}</span>
        {somenteLeitura && (
          <span className="rounded-full bg-surface-hover px-2 py-0.5 font-medium text-ink-muted">Só leitura</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {compartilhar && (
            <CompartilharPagina pageId={page.id} euId={compartilhar.euId} quantasInicial={compartilhar.quantas} />
          )}
          {!somenteLeitura && <SeletorDePaleta valor={fundo} aoEscolher={mudarFundo} />}
        </div>
        <button
          type="button"
          onClick={exportarPdf}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-medium text-ink hover:bg-surface-hover"
        >
          Exportar PDF
        </button>
        {status !== "idle" && (
          <>
            <span className="text-ink-muted">·</span>
            <span
              className={
                status === "saving" ? "text-warning" : "text-success"
              }
            >
              {status === "saving" ? "Salvando..." : "Salvo"}
            </span>
          </>
        )}
      </div>
      {erroDoFundo && <p className="-mt-4 mb-4 text-xs text-danger">{erroDoFundo}</p>}

      {problema && (
        <div role="alert" className="-mt-3 mb-4 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning">
          {problema === "conflito" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1">
                Outra pessoa salvou esta página enquanto você editava. O que você mudou por último ainda não foi salvo.
              </span>
              <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">
                Ver a versão nova
              </button>
              <button type="button" onClick={() => gravar(tituloAtual.current, true)} className="font-semibold underline">
                Salvar a minha por cima
              </button>
            </div>
          ) : problema === "so-leitura" ? (
            "Você só pode ver esta página: o que escrever aqui não é salvo."
          ) : problema === "sem-acesso" ? (
            "Você não tem mais acesso a esta página."
          ) : (
            "Não deu pra salvar agora. Confira a internet e continue: a próxima mudança tenta de novo."
          )}
        </div>
      )}

      <div
        className={`rounded-2xl border border-line px-2 py-4 sm:px-6 ${estilo ? "wiki-fundo" : "bg-surface"}`}
        style={
          estilo
            ? ({ backgroundColor: estilo.fundo, "--wiki-fundo": estilo.fundo, "--wiki-texto": estilo.texto } as CSSProperties)
            : undefined
        }
      >
        <BlockNoteView
          editor={editor}
          editable={!somenteLeitura}
          theme={estilo?.tema ?? "dark"}
          onChange={() => scheduleSave(tituloAtual.current)}
          formattingToolbar={false}
        >
          {/* O menu de formatação de sempre, com o botão de cores trocado pelo da paleta grande. */}
          <FormattingToolbarController
            formattingToolbar={() => (
              <FormattingToolbar>
                {getFormattingToolbarItems().map((item) =>
                  item.key === "colorStyleButton" ? <BotaoDeCoresDoEditor key="colorStyleButton" /> : item
                )}
              </FormattingToolbar>
            )}
          />
        </BlockNoteView>
      </div>
      </div>

      <div className="so-imprime texto-pdf">
        <h1>{title.trim() || "Sem título"}</h1>
        <p className="texto-pdf-meta">
          {page.created_by_label ? `por ${page.created_by_label} · ` : ""}
          Atualizado em {new Date(updatedAt).toLocaleDateString("pt-BR")}
        </p>
        <div dangerouslySetInnerHTML={{ __html: htmlParaImprimir }} />
      </div>
    </div>
  );
}
