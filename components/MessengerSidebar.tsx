"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Channel, Profile } from "@/lib/types";
import { channelKey, dmKey, useNotifications } from "@/lib/notifications";

export default function MessengerSidebar({
  channels,
  profiles,
}: {
  channels: Channel[];
  profiles: Profile[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const { unreadByConversation } = useNotifications();

  async function handleNewChannel() {
    const nomeDigitado = window.prompt("Nome do canal (sem #, sem espaços):");
    if (!nomeDigitado) return;
    const slug = nomeDigitado.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("channels")
      .insert({ name: slug })
      .select()
      .single();
    setCreating(false);

    if (!error && data) {
      router.push(`/chat/canal/${data.id}`);
      router.refresh();
    } else if (error) {
      window.alert(
        "Não foi possível criar o canal (talvez já exista um com esse nome)."
      );
    }
  }

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto bg-[#1a1330] text-slate-200">
      <div className="px-4 py-4 text-sm font-bold text-white">Mensagens</div>

      <div className="px-2">
        <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Canais
        </p>
        {channels.map((c) => {
          const href = `/chat/canal/${c.id}`;
          const active = pathname === href;
          const unread = unreadByConversation[channelKey(c.id)] ?? 0;
          return (
            <Link
              key={c.id}
              href={href}
              className={`flex items-center justify-between truncate rounded-md px-2 py-1.5 text-sm ${
                active
                  ? "bg-[#3d2a5c] text-white"
                  : unread > 0
                  ? "text-white"
                  : "text-slate-300 hover:bg-[#2a1f45]"
              }`}
            >
              <span className="truncate"># {c.name}</span>
              {!active && unread > 0 && (
                <span className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={handleNewChannel}
          disabled={creating}
          className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-400 hover:bg-[#2a1f45] disabled:opacity-50"
        >
          {creating ? "Criando..." : "+ Adicionar canal"}
        </button>
      </div>

      <div className="px-2">
        <p className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Mensagens diretas
        </p>
        {profiles.map((p) => {
          const href = `/chat/dm/${p.id}`;
          const active = pathname === href;
          const label = p.name || p.username || "Sem nome";
          const unread = unreadByConversation[dmKey(p.id)] ?? 0;
          return (
            <Link
              key={p.id}
              href={href}
              className={`flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm ${
                active
                  ? "bg-[#3d2a5c] text-white"
                  : unread > 0
                  ? "text-white"
                  : "text-slate-300 hover:bg-[#2a1f45]"
              }`}
            >
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-600 text-[10px] font-semibold text-white">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  label.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="flex-1 truncate">{label}</span>
              {!active && unread > 0 && (
                <span className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
        {profiles.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-slate-500">
            Ainda não tem mais ninguém cadastrado.
          </p>
        )}
      </div>
    </aside>
  );
}
