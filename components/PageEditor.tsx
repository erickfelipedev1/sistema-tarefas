"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { pt } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { createClient } from "@/lib/supabase/client";
import { formatarRelativo } from "@/lib/format";
import type { CorDeFundoDaPagina, Page } from "@/lib/types";

// Fundo da página (migration 0125), igual pra todo mundo que abre. No branco
// e no bege o editor usa o tema claro (as cores de letra e de marca-texto são
// as feitas pra fundo claro); no preto e no padrão, o escuro de sempre.
const FUNDOS: { valor: CorDeFundoDaPagina | null; rotulo: string; amostra: string }[] = [
  { valor: null, rotulo: "Padrão", amostra: "#1f1f1f" },
  { valor: "branco", rotulo: "Branco", amostra: "#ffffff" },
  { valor: "bege", rotulo: "Bege", amostra: "#f3ead6" },
  { valor: "preto", rotulo: "Preto", amostra: "#000000" },
];
const ESTILO_DO_FUNDO: Record<CorDeFundoDaPagina, { tema: "light" | "dark"; fundo: string; texto: string }> = {
  branco: { tema: "light", fundo: "#ffffff", texto: "#2b2b2b" },
  bege: { tema: "light", fundo: "#f3ead6", texto: "#3b3226" },
  preto: { tema: "dark", fundo: "#000000", texto: "#e8e8e8" },
};

export default function PageEditor({ page }: { page: Page }) {
  const supabase = createClient();
  const [title, setTitle] = useState(page.title);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [updatedAt, setUpdatedAt] = useState(page.updated_at);
  const [htmlParaImprimir, setHtmlParaImprimir] = useState("");
  const [fundo, setFundo] = useState<CorDeFundoDaPagina | null>(page.cor_fundo ?? null);
  const [erroDoFundo, setErroDoFundo] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estilo = fundo ? ESTILO_DO_FUNDO[fundo] : null;

  async function mudarFundo(valor: CorDeFundoDaPagina | null) {
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

  function scheduleSave(nextTitle: string) {
    setStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const agora = new Date().toISOString();
      await supabase
        .from("pages")
        .update({
          title: nextTitle.trim() || "Sem título",
          content: editor.document,
          updated_at: agora,
        })
        .eq("id", page.id);
      setUpdatedAt(agora);
      setStatus("saved");
    }, 800);
  }

  return (
    <div>
      <div className="nao-imprime">
      <input
        value={title}
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
        <div role="radiogroup" aria-label="Cor de fundo da página" className="ml-auto flex flex-wrap items-center gap-1">
          <span className="mr-0.5">Cor da página</span>
          {FUNDOS.map((f) => {
            const ativo = f.valor === fundo;
            return (
              <button
                key={f.rotulo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => mudarFundo(f.valor)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium transition-colors ${
                  ativo ? "border-brand bg-brand-light text-brand-forte" : "border-line text-ink hover:bg-surface-hover"
                }`}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full border border-ink-muted/40"
                  style={{ backgroundColor: f.amostra }}
                />
                {f.rotulo}
              </button>
            );
          })}
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
          theme={estilo?.tema ?? "dark"}
          onChange={() => scheduleSave(title)}
        />
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
