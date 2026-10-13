"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatarRelativo } from "@/lib/format";
import { tocarSomNotificacao } from "@/lib/som";
import type { UserNotification } from "@/lib/types";
import { BellIcon } from "./ui/icons";

const LARGURA = 352; // px

// Sininho da equipe: os avisos que chegam pra mim (hoje, quando alguém me
// menciona num comentário de tarefa). Acende na hora por Realtime, abre uma
// lista e leva direto pro que foi dito. Os avisos moram em user_notifications
// (migration 0064); cada pessoa só enxerga e mexe nos próprios.
export default function Sininho({
  currentUserId,
  className = "",
  aoNavegar,
}: {
  currentUserId: string;
  // Classes do botão (cada lugar onde aparece tem um fundo diferente).
  className?: string;
  aoNavegar?: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const idCanal = useId();
  const [avisos, setAvisos] = useState<UserNotification[]>([]);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Clicar fora (ou apertar Esc) fecha a lista.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || botao.current?.contains(alvo)) return;
      setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const naoLidos = avisos.filter((a) => !a.read_at).length;

  useEffect(() => {
    let ativo = true;
    supabase
      .from("user_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!ativo) return;
        setErro(!!error);
        setAvisos((data ?? []) as UserNotification[]);
      });

    const canal = supabase
      .channel(`sininho-${idCanal}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `profile_id=eq.${currentUserId}` },
        (payload) => {
          const novo = payload.new as UserNotification;
          setAvisos((atual) => (atual.some((a) => a.id === novo.id) ? atual : [novo, ...atual].slice(0, 30)));
          // O sininho aparece em duas casas (menu e barra do celular), uma
          // sempre escondida: só a visível toca o som.
          if (botao.current && botao.current.offsetParent !== null) {
            try {
              tocarSomNotificacao();
            } catch {
              // Sem áudio liberado pelo navegador: o sininho acende do mesmo jeito.
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_notifications", filter: `profile_id=eq.${currentUserId}` },
        (payload) => {
          const novo = payload.new as UserNotification;
          setAvisos((atual) => atual.map((a) => (a.id === novo.id ? { ...a, ...novo } : a)));
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, idCanal]);

  const abrirOuFechar = useCallback(() => {
    if (!aberto && botao.current) {
      const r = botao.current.getBoundingClientRect();
      const largura = Math.min(LARGURA, window.innerWidth - 16);
      setPosicao({
        top: r.bottom + 8,
        left: Math.max(8, Math.min(r.left, window.innerWidth - largura - 8)),
      });
    }
    setAberto((a) => !a);
  }, [aberto]);

  async function marcarComoLido(aviso: UserNotification) {
    if (aviso.read_at) return;
    const agora = new Date().toISOString();
    setAvisos((atual) => atual.map((a) => (a.id === aviso.id ? { ...a, read_at: agora } : a)));
    await supabase.from("user_notifications").update({ read_at: agora }).eq("id", aviso.id);
  }

  async function marcarTodos() {
    const agora = new Date().toISOString();
    setAvisos((atual) => atual.map((a) => (a.read_at ? a : { ...a, read_at: agora })));
    await supabase.from("user_notifications").update({ read_at: agora }).is("read_at", null);
  }

  function abrirAviso(aviso: UserNotification) {
    marcarComoLido(aviso);
    setAberto(false);
    aoNavegar?.();
    router.push(aviso.url);
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={abrirOuFechar}
        aria-label={naoLidos > 0 ? `Notificações (${naoLidos} não lidas)` : "Notificações"}
        aria-expanded={aberto}
        className={`relative rounded-lg p-2 ${className}`}
      >
        <BellIcon className="h-5 w-5" />
        {naoLidos > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {naoLidos > 9 ? "9+" : naoLidos}
          </span>
        )}
      </button>

      {aberto && posicao && (
        <div
          ref={caixa}
          role="dialog"
          aria-label="Notificações"
          style={{ top: posicao.top, left: posicao.left, width: Math.min(LARGURA, window.innerWidth - 16) }}
          className="fixed z-50 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-dropdown"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            {naoLidos > 0 && (
              <button type="button" onClick={marcarTodos} className="text-xs font-medium text-brand-forte hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {erro ? (
              <p className="px-4 py-6 text-center text-sm text-danger">
                Não deu pra carregar. Confere se a migration 0064_mencoes_e_sininho.sql já foi rodada no Supabase.
              </p>
            ) : avisos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                Nada por aqui. Quando alguém te mencionar num comentário, o aviso aparece neste sininho.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {avisos.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => abrirAviso(a)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover ${
                        a.read_at ? "" : "bg-brand/5"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${a.read_at ? "bg-transparent" : "bg-brand-forte"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{a.title}</span>
                        <span className="mt-0.5 line-clamp-2 block break-words text-xs text-ink-muted">{a.body}</span>
                        <span className="mt-1 block text-[11px] text-ink-muted">{formatarRelativo(a.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
