"use client";

// Estado compartilhado só da área de Mensagens: qual modal está aberto
// ("Novo canal" / "Nova mensagem"). Existe pra que tanto o botão "+" da
// barra lateral quanto os botões do estado vazio da conversa consigam
// abrir os mesmos modais.
import { createContext, useContext, useMemo, useState } from "react";

type ChatUIContextValue = {
  novoCanalAberto: boolean;
  novaMensagemAberto: boolean;
  abrirNovoCanal: () => void;
  abrirNovaMensagem: () => void;
  fechar: () => void;
};

const ChatUIContext = createContext<ChatUIContextValue | null>(null);

export function useChatUI() {
  const ctx = useContext(ChatUIContext);
  if (!ctx) {
    throw new Error("useChatUI precisa ser usado dentro de <ChatUIProvider>");
  }
  return ctx;
}

export function ChatUIProvider({ children }: { children: React.ReactNode }) {
  const [modalAberto, setModalAberto] = useState<
    "canal" | "mensagem" | null
  >(null);

  const value = useMemo<ChatUIContextValue>(
    () => ({
      novoCanalAberto: modalAberto === "canal",
      novaMensagemAberto: modalAberto === "mensagem",
      abrirNovoCanal: () => setModalAberto("canal"),
      abrirNovaMensagem: () => setModalAberto("mensagem"),
      fechar: () => setModalAberto(null),
    }),
    [modalAberto]
  );

  return (
    <ChatUIContext.Provider value={value}>{children}</ChatUIContext.Provider>
  );
}
