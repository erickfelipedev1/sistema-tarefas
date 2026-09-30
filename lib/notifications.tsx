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
import { prepararSom, tocarSomNotificacao } from "@/lib/som";
import { ativarPushNoAparelho, pushAtivoNoAparelho } from "@/lib/push-client";
import { textoDaMensagem } from "@/lib/chat";

export function dmKey(otherUserId: string) {
  return `dm:${otherUserId}`;
}

export function channelKey(channelId: string) {
  return `channel:${channelId}`;
}

type PresenceStatus = "online" | "away";

type NotificationsContextValue = {
  unreadByConversation: Record<string, number>;
  totalUnread: number;
  markAsRead: (conversationKey: string) => void;
  setOpenConversation: (conversationKey: string | null) => void;
  notificationPermission: NotificationPermission | "unsupported";
  requestNotificationPermission: () => void;
  // Este aparelho está inscrito nas notificações no celular (Web Push)?
  // null = ainda verificando.
  pushAtivo: boolean | null;
  // Quem está online agora (e se está "ausente" — aba em segundo plano),
  // via Supabase Realtime Presence. Quem não aparece aqui está offline.
  presenceByUserId: Record<string, PresenceStatus>;
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
  const [presenceByUserId, setPresenceByUserId] = useState<
    Record<string, PresenceStatus>
  >({});

  // Guardados em ref (não em state) porque só são lidos dentro do listener
  // do realtime, que é montado uma única vez.
  const [pushAtivo, setPushAtivo] = useState<boolean | null>(null);
  const pushAtivoRef = useRef(false);
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

  useEffect(() => {
    pushAtivoNoAparelho().then((ativo) => {
      pushAtivoRef.current = ativo;
      setPushAtivo(ativo);
    });
  }, []);

  // Pede permissão e inscreve o aparelho nas notificações no celular.
  const requestNotificationPermission = useCallback(() => {
    if (typeof window === "undefined") return;
    ativarPushNoAparelho().then((resultado) => {
      if ("Notification" in window) setPermission(Notification.permission);
      if (resultado.status === "ok") {
        pushAtivoRef.current = true;
        setPushAtivo(true);
        window.alert("Notificações ativadas neste aparelho. Use \"Testar notificação\" no menu pra conferir.");
      } else {
        window.alert(resultado.motivo);
      }
    });
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

  // Destrava o áudio no primeiro clique/tecla (regra dos navegadores) pra o
  // som de notificação poder tocar depois, mesmo com a aba em segundo plano.
  useEffect(() => {
    function destravar() {
      prepararSom();
    }
    window.addEventListener("pointerdown", destravar);
    window.addEventListener("keydown", destravar);
    return () => {
      window.removeEventListener("pointerdown", destravar);
      window.removeEventListener("keydown", destravar);
    };
  }, []);

  // Presença online: cada aba aberta "se marca presente" num canal
  // compartilhado (sem precisar de nenhuma tabela nova no banco). Fica
  // "ausente" quando a aba vai pra segundo plano, e "offline" assim que a
  // aba fecha ou perde conexão (o Supabase remove a presença sozinho).
  useEffect(() => {
    const canal = supabase.channel("presenca-online", {
      config: { presence: { key: currentUserId } },
    });

    function statusAtual(): PresenceStatus {
      return typeof document !== "undefined" && document.hidden
        ? "away"
        : "online";
    }

    canal
      .on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState<{ status: PresenceStatus }>();
        const mapa: Record<string, PresenceStatus> = {};
        Object.entries(estado).forEach(([userId, presencas]) => {
          const ultima = presencas[presencas.length - 1];
          mapa[userId] = ultima?.status === "away" ? "away" : "online";
        });
        setPresenceByUserId(mapa);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          canal.track({ status: statusAtual() });
        }
      });

    function aoMudarVisibilidade() {
      canal.track({ status: statusAtual() });
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

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

          tocarSomNotificacao();

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            // Com o push ativo, quem mostra é o service worker — não duplica.
            !pushAtivoRef.current
          ) {
            try {
              // silent: o som é o do próprio sistema (tocarSomNotificacao),
              // pra não tocar dois sons juntos.
              const notificacao = new Notification("Nova tarefa atribuída a você", {
                body: nova.title,
                silent: true,
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

          tocarSomNotificacao();

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            // Com o push ativo, quem mostra é o service worker — não duplica.
            !pushAtivoRef.current
          ) {
            const remetente =
              profilesByIdRef.current[nova.sender_id] || "Alguém";
            const titulo = ehCanal
              ? `#${channelsByIdRef.current[nova.channel_id as string] ?? "canal"} · ${remetente}`
              : remetente;

            try {
              const notificacao = new Notification(titulo, {
                body: textoDaMensagem(nova),
                silent: true,
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
        pushAtivo,
        presenceByUserId,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
