"use client";

import { useRef, useState } from "react";
import { formatarTamanho, LIMITE_ANEXO_MB } from "@/lib/chat";
import { FileTextIcon, PlusIcon, SendIcon, XIcon } from "@/components/ui/icons";
import EmojiPicker from "./EmojiPicker";
import MencaoInput from "./MencaoInput";
import { idsMencionados, type PessoaMencionavel } from "@/lib/mencoes";

// Campo de escrever mensagem (conversa direta e canal): "+" pra anexar um
// arquivo, caixa com emoji à direita e botão verde de enviar. Enter envia;
// Shift+Enter quebra linha. O texto é opcional quando há anexo (vira
// legenda). Digitar "@" abre a lista de quem pode ser mencionado; quem foi
// escolhido (e continua escrito no texto) sai junto no envio.
export default function ChatComposer({
  texto,
  setTexto,
  enviar,
  enviando,
  placeholder,
  erro,
  pessoas,
  semTodos = false,
}: {
  texto: string;
  setTexto: (valor: string | ((atual: string) => string)) => void;
  enviar: (arquivo: File | null, mencoes: string[]) => Promise<boolean>;
  enviando: boolean;
  placeholder: string;
  erro: string | null;
  // Quem dá pra mencionar nesta conversa (sem quem está escrevendo).
  pessoas: readonly PessoaMencionavel[];
  semTodos?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const podeEnviar = !enviando && (!!texto.trim() || !!arquivo);

  async function submeter() {
    if (!podeEnviar) return;
    const ok = await enviar(arquivo, idsMencionados(texto, pessoas, escolhidos));
    if (ok) {
      setArquivo(null);
      setEscolhidos([]);
    }
  }

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    if (f.size > LIMITE_ANEXO_MB * 1024 * 1024) {
      setErroArquivo(`O arquivo pode ter no máximo ${LIMITE_ANEXO_MB} MB.`);
      return;
    }
    setErroArquivo(null);
    setArquivo(f);
    textareaRef.current?.focus();
  }

  const mensagemErro = erroArquivo ?? erro;

  return (
    <div className="border-t border-line bg-surface px-3 py-3 sm:px-5">
      {arquivo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
          <FileTextIcon className="h-4 w-4 flex-shrink-0 text-ink-muted" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{arquivo.name}</span>
          <span className="flex-shrink-0 text-xs text-ink-muted">{formatarTamanho(arquivo.size)}</span>
          <button
            type="button"
            onClick={() => setArquivo(null)}
            aria-label="Remover anexo"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {mensagemErro && <p className="mb-2 text-xs text-danger">{mensagemErro}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submeter();
        }}
        className="flex items-end gap-2"
      >
        <button
          type="button"
          onClick={() => inputArquivo.current?.click()}
          disabled={enviando}
          aria-label="Anexar arquivo"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted hover:bg-surface-hover hover:text-ink disabled:opacity-40"
        >
          <PlusIcon className="h-[18px] w-[18px]" />
        </button>
        <input ref={inputArquivo} type="file" onChange={escolher} className="hidden" />

        <div className="flex min-h-[44px] flex-1 items-end rounded-xl border border-line bg-canvas px-3 py-1.5 focus-within:border-brand">
          <MencaoInput
            campoRef={textareaRef}
            value={texto}
            onChange={(valor) => setTexto(valor)}
            pessoas={pessoas}
            semTodos={semTodos}
            aoEscolher={(id) => setEscolhidos((atual) => (atual.includes(id) ? atual : [...atual, id]))}
            aoTeclar={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submeter();
              }
            }}
            multilinha
            linhas={1}
            placeholder={arquivo ? "Adicione uma legenda (opcional)..." : placeholder}
            ariaLabel="Mensagem"
            className="max-h-32 w-full resize-none self-center bg-transparent py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <EmojiPicker
            onSelect={(emoji) => {
              setTexto((atual) => `${atual}${emoji}`);
              textareaRef.current?.focus();
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!podeEnviar}
          aria-label="Enviar mensagem"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand text-navy transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="h-[18px] w-[18px]" />
        </button>
      </form>
    </div>
  );
}
