"use client";

import { usePathname } from "next/navigation";
import type { Channel, Profile } from "@/lib/types";
import MessengerSidebar, {
  type ConversaCanalPreview,
  type ConversaDmPreview,
} from "./MessengerSidebar";
import { ChatUIProvider } from "./ChatUIContext";
import NovoCanalModal from "./NovoCanalModal";
import NovaMensagemModal from "./NovaMensagemModal";

// Casca responsiva da área de Mensagens: no desktop, barra lateral +
// conversa lado a lado, sempre. No mobile, só uma coluna por vez — a lista
// (em /chat) ou a conversa aberta (em /chat/canal/... e /chat/dm/...), com
// botão de voltar nos cabeçalhos das conversas.
export default function ChatShell({
  channels,
  profiles,
  previewCanais,
  previewDms,
  children,
}: {
  channels: Channel[];
  profiles: Profile[];
  previewCanais: Record<string, ConversaCanalPreview>;
  previewDms: Record<string, ConversaDmPreview>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const naListaPrincipal = pathname === "/chat";

  return (
    <ChatUIProvider>
      <div className="flex h-full">
        <div
          className={`${
            naListaPrincipal ? "flex w-full" : "hidden"
          } md:flex md:w-[280px] md:flex-shrink-0`}
        >
          <MessengerSidebar
            channels={channels}
            profiles={profiles}
            previewCanais={previewCanais}
            previewDms={previewDms}
          />
        </div>
        <div
          className={`min-w-0 flex-1 ${
            naListaPrincipal ? "hidden md:block" : "block"
          }`}
        >
          {children}
        </div>
      </div>
      <NovoCanalModal />
      <NovaMensagemModal profiles={profiles} />
    </ChatUIProvider>
  );
}
