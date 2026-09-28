"use client";

import { Button } from "@/components/ui/Button";
import { MessageCircleIcon } from "@/components/ui/icons";
import { useChatUI } from "@/components/ChatUIContext";

export default function ChatHomePage() {
  const { abrirNovaMensagem, abrirNovoCanal } = useChatUI();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-chat-bg px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chat-surface text-chat-muted">
        <MessageCircleIcon className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-sm font-semibold text-white">Comece uma conversa</h1>
        <p className="mt-1 max-w-xs text-xs text-chat-muted">
          Escolha um canal ou uma pessoa na lateral, ou inicie algo novo.
        </p>
      </div>
      <div className="mt-1 flex gap-2">
        <Button size="sm" onClick={abrirNovaMensagem}>
          Nova mensagem
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={abrirNovoCanal}
          className="border-chat-border bg-transparent text-slate-200 hover:bg-chat-surface-hover"
        >
          Criar canal
        </Button>
      </div>
    </div>
  );
}
