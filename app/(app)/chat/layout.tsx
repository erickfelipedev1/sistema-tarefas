import { createClient } from "@/lib/supabase/server";
import ChatShell from "@/components/ChatShell";
import type {
  ConversaCanalPreview,
  ConversaDmPreview,
} from "@/components/MessengerSidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: channels }, { data: profiles }, { data: mensagensRecentes }] =
    await Promise.all([
      supabase.from("channels").select("id, name, created_at").order("name"),
      supabase
        .from("profiles")
        .select("id, username, name, avatar_url")
        .neq("id", user?.id ?? "")
        .order("name", { ascending: true }),
      // Últimas mensagens — usadas só pra montar os previews "última
      // mensagem..." da barra lateral. O RLS de "messages" já garante que só
      // voltam mensagens de canal (visíveis a todo mundo) ou DMs em que o
      // usuário é remetente ou destinatário, então não precisa filtrar de
      // novo aqui. Limite generoso o bastante pra cobrir a última mensagem
      // de cada conversa mesmo em times com bastante volume de chat.
      supabase
        .from("messages")
        .select("id, sender_id, recipient_id, channel_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

  const previewCanais: Record<string, ConversaCanalPreview> = {};
  const previewDms: Record<string, ConversaDmPreview> = {};

  (mensagensRecentes ?? []).forEach((m) => {
    if (m.channel_id) {
      if (!previewCanais[m.channel_id]) {
        previewCanais[m.channel_id] = {
          content: m.content,
          created_at: m.created_at,
        };
      }
      return;
    }

    if (!user) return;
    const souEuQueEnviei = m.sender_id === user.id;
    const outraPessoa = souEuQueEnviei ? m.recipient_id : m.sender_id;
    if (!outraPessoa) return;
    if (!previewDms[outraPessoa]) {
      previewDms[outraPessoa] = {
        content: m.content,
        created_at: m.created_at,
        mine: souEuQueEnviei,
      };
    }
  });

  return (
    <div className="flex h-screen">
      <ChatShell
        channels={channels ?? []}
        profiles={profiles ?? []}
        previewCanais={previewCanais}
        previewDms={previewDms}
      >
        {children}
      </ChatShell>
    </div>
  );
}
