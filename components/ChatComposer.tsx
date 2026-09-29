"use client";

import { useRef } from "react";
import { SendIcon } from "@/components/ui/icons";
import EmojiPicker from "./EmojiPicker";

// Campo de escrever mensagem (conversa direta e canal): caixa com emoji à
// direita e botão verde de enviar. Enter envia; Shift+Enter quebra linha.
export default function ChatComposer({
  texto,
  setTexto,
  enviar,
  enviando,
  placeholder,
}: {
  texto: string;
  setTexto: (valor: string | ((atual: string) => string)) => void;
  enviar: () => void;
  enviando: boolean;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="flex items-end gap-2 border-t border-line bg-surface px-3 py-3 sm:px-5"
    >
      <div className="flex min-h-[44px] flex-1 items-end rounded-xl border border-line bg-canvas px-3 py-1.5 focus-within:border-brand">
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          placeholder={placeholder}
          aria-label="Mensagem"
          className="max-h-32 flex-1 resize-none self-center bg-transparent py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
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
        disabled={enviando || !texto.trim()}
        aria-label="Enviar mensagem"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand text-navy transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendIcon className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}
