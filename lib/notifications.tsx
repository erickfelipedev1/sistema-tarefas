"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message, Task } from "@/lib/types";

export function dmKey(otherUserId: string) {
  return `dm:${otherUserId}`;
}

export function channelKey(channelId: string) {
  return `channel:${channelId}`;
}

type NotificationsContextValue = {
  unreadByConversation: Record<string, number>;
  totalUnread: number;
  markAsRead: (conversationKey: string) => void;
  setOpenConversation: (conversationKey: string | null) => void;
  notificationPermission: NotificationPermission | "unsupported";
  requestNotificationPermission: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications precisa ser usado dentro de <NotificationsProvider>"
    );
  }
  return ctx;
}

export default function NotificationsProvider({
  currentUserId,
  children,
}: {
  currentUserId: string;
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({});
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  // Guardados em ref (não em state) porque só são lidos dentro do listener
  // do realtime, que é montado uma única vez.
  const openConversationRef = useRef<string | null>(null);
  const profilesByIdRef = useRef<Record<string, string>>({});
  const channelsByIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const requestNotificationPermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((resultado) =>
      setPermission(resultado)
    );
  }, []);

  // Estado inicial: quantas mensagens não lidas já existem em cada conversa.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const [
        { data: reads },
        { data: profiles },
        { data: channels },
        { data: channelMessages },
        { data: dmMessages },
      ] = await Promise.all([
        supabase
          .from("message_reads")
          .select("conversation_key, last_read_at")
          .eq("user_id", currentUserId),
        supabase.from("profiles").select("id, name, username"),
        supabase.from("channels").select("id, name"),
        supabase
          .from("messages")
          .select("id, channel_id, sender_id, created_at")
          .not("channel_id", "is", null),
        supabase
          .from("messages")
          .select("id, sender_id, created_at")
          .eq("recipient_id", currentUserId),
      ]);

      if (cancelado) return;

      const mapaProfiles: Record<string, string> = {};
      (profiles ?? []).forEach((p) => {
        mapaProfiles[p.id] = p.name || p.username || "Alguém";
      });
      profilesByIdRef.current = mapaProfiles;

      const mapaCanais: Record<string, string> = {};
      (channels ?? []).forEach((c) => {
        mapaCanais[c.id] = c.name;
      });
      channelsByIdRef.current = mapaCanais;

      const ultimaLeituraPorChave: Record<string, string> = {};
      (reads ?? []).forEach((r) => {
        ultimaLeituraPorChave[r.conversation_key] = r.last_read_at;
      });

      const contagem: Record<string, number> = {};

      (channelMessages ?? []).forEach((m) => {
        if (m.sender_id === currentUserId || !m.channel_id) return;
        const key = channelKey(m.channel_id);
        const desde = ultimaLeituraPorChave[key];
        if (!desde || new Date(m.created_at) > new Date(desde)) {
          contagem[key] = (contagem[key] ?? 0) + 1;
        }
      });

      (dmMessages ?? []).forEach((m) => {
        const key = dmKey(m.sender_id);
        const desde = ultimaLeituraPorChave[key];
        if (!desde || new Date(m.created_at) > new Date(desde)) {
          contagem[key] = (contagem[key] ?? 0) + 1;
        }
      });

      setUnreadByConversation(contagem);
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const markAsRead = useCallback(
    (conversationKey: string) => {
      setUnreadByConversation((atual) => {
        if (!atual[conversationKey]) return atual;
        const copia = { ...atual };
        delete copia[conversationKey];
        return copia;
      });
      supabase
        .from("message_reads")
        .upsert(
          {
            user_id: currentUserId,
            conversation_key: conversationKey,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "user_id,conversation_key" }
        )
        .then(() => {
          // não precisa fazer nada com o resultado
        });
    },
    [currentUserId, supabase]
  );

  const setOpenConversation = useCallback(
    (conversationKey: string | null) => {
      openConversationRef.current = conversationKey;
    },
    []
  );

  // Escuta toda mensagem nova (o RLS do Supabase já garante que só chegam
  // mensagens de canais, ou DMs em que eu sou remetente ou destinatário) e
  // também toda tarefa nova que for atribuída a mim.
  useEffect(() => {
    const canal = supabase
      .channel("global-message-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const nova = payload.new as Task;

          // Só notifica quando alguém me coloca como um dos responsáveis —
          // se fui eu quem criou (mesmo que pra mim mesmo), não precisa de
          // aviso.
          if (!nova.assigned_to.includes(currentUserId)) return;
          if (nova.created_by === currentUserId) return;

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const notificacao = new Notification("Nova tarefa atribuída a você", {
                body: nova.title,
              });
              notificacao.onclick = () => {
                window.focus();
                window.location.href = nova.project_id
                  ? `/projetos/${nova.project_id}`
                  : "/board";
              };
            } catch {
              // alguns navegadores recusam notificação fora de contexto
              // específico — ignora silenciosamente.
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const nova = payload.new as Message;
          if (nova.sender_id === currentUserId) return;

          const ehDm = !!nova.recipient_id && nova.recipient_id === currentUserId;
          const ehCanal = !!nova.channel_id;
          if (!ehDm && !ehCanal) return;

          const key = ehCanal
            ? channelKey(nova.channel_id as string)
            : dmKey(nova.sender_id);

          if (openConversationRef.current === key) {
            // Já está vendo essa conversa na tela — não precisa avisar.
            return;
          }

          setUnreadByConversation((atual) => ({
            ...atual,
            [key]: (atual[key] ?? 0) + 1,
          }));

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const remetente =
              profilesByIdRef.current[nova.sender_id] || "Alguém";
            const titulo = ehCanal
              ? `#${channelsByIdRef.current[nova.channel_id as string] ?? "canal"} · ${remetente}`
              : remetente;

            try {
              const notificacao = new Notification(titulo, {
                body: nova.content,
              });
              notificacao.onclick = () => {
                window.focus();
                window.location.href = ehCanal
                  ? `/chat/canal/${nova.channel_id}`
                  : `/chat/dm/${nova.sender_id}`;
              };
            } catch {
              // alguns navegadores recusam notificação fora de contexto
              // específico — ignora silenciosamente.
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const totalUnread = Object.keys(unreadByConversation).reduce(
    (soma, key) => soma + (unreadByConversation[key] ?? 0),
    0
  );

  return (
    <NotificationsContext.Provider
      value={{
        unreadByConversation,
        totalUnread,
        markAsRead,
        setOpenConversation,
        notificationPermission: permission,
        requestNotificationPermission,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
