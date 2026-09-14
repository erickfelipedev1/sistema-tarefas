"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { useNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Client, Project } from "@/lib/types";

const ITEMS = [
  { href: "/board", label: "Tarefas" },
  { href: "/calendario", label: "Calendário" },
  { href: "/wiki", label: "Wiki" },
  { href: "/projetos", label: "Projetos" },
  { href: "/arquivos", label: "Arquivos" },
  { href: "/chat", label: "Mensagens" },
];

export default function Sidebar({
  userLabel,
  userName,
  avatarUrl,
  initialProjects,
  initialClients,
}: {
  userLabel: string;
  userName: string | null;
  avatarUrl: string | null;
  initialProjects: Project[];
  initialClients: Client[];
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const {
    totalUnread,
    notificationPermission,
    requestNotificationPermission,
  } = useNotifications();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Mantém a lista de projetos do menu sincronizada em tempo real (por
  // exemplo, quando um projeto novo é criado na tela de Projetos).
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-projects-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          setProjects((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Project;
              if (current.some((p) => p.id === novo.id)) return current;
              return [...current, novo].sort((a, b) =>
                a.name.localeCompare(b.name)
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Project).id;
              return current.filter((p) => p.id !== removidoId);
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Project;
              return current
                .map((p) => (p.id === atualizado.id ? atualizado : p))
                .sort((a, b) => a.name.localeCompare(b.name));
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O mesmo, só que pra lista de clientes (Drive de arquivos).
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-clients-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        (payload) => {
          setClients((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Client;
              if (current.some((c) => c.id === novo.id)) return current;
              return [...current, novo].sort((a, b) =>
                a.name.localeCompare(b.name)
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Client).id;
              return current.filter((c) => c.id !== removidoId);
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Client;
              return current
                .map((c) => (c.id === atualizado.id ? atualizado : c))
                .sort((a, b) => a.name.localeCompare(b.name));
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-4 py-5">
        <span className="text-sm font-semibold text-slate-900">
          Sistema de Organização
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const showBadge = item.href === "/chat" && totalUnread > 0;

          if (item.href === "/projetos") {
            return (
              <ExpandableNavItem
                key={item.href}
                href="/projetos"
                label="Projetos"
                active={active}
                items={projects}
                itemHref={(id) => `/projetos/${id}`}
                emptyLabel="Nenhum projeto ainda."
                defaultOpen={pathname.startsWith("/projetos")}
              />
            );
          }

          if (item.href === "/arquivos") {
            return (
              <ExpandableNavItem
                key={item.href}
                href="/arquivos"
                label="Arquivos"
                active={active}
                items={clients}
                itemHref={(id) => `/arquivos/cliente/${id}`}
                emptyLabel="Nenhum cliente ainda."
                defaultOpen={pathname.startsWith("/arquivos")}
              />
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{item.label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {notificationPermission === "default" && (
        <div className="px-3 pb-2">
          <button
            onClick={requestNotificationPermission}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
          >
            🔔 Ativar notificações de mensagem
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-slate-200 p-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-semibold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (userName || userLabel || "?").slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="flex-1 truncate text-xs text-slate-600">
          {userName || userLabel}
        </span>
        <LogoutButton />
      </div>
    </aside>
  );
}

// Item de menu que expande e mostra uma lista de sub-itens (usado por
// "Projetos" e "Arquivos") — clica na setinha e abre, sem sair da página.
function ExpandableNavItem({
  href,
  label,
  active,
  items,
  itemHref,
  emptyLabel,
  defaultOpen,
}: {
  href: string;
  label: string;
  active: boolean;
  items: { id: string; name: string }[];
  itemHref: (id: string) => string;
  emptyLabel: string;
  defaultOpen: boolean;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <div>
      <div
        className={`flex items-center justify-between rounded-lg pr-1 text-sm font-medium ${
          active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Link href={href} className="flex-1 px-3 py-2">
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          title={aberto ? "Recolher" : "Expandir"}
          className={`rounded-md px-2 py-2 text-xs ${
            active ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-slate-700"
          }`}
        >
          {aberto ? "▾" : "▸"}
        </button>
      </div>

      {aberto && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
          {items.map((item) => {
            const subHref = itemHref(item.id);
            const subActive = pathname === subHref;
            return (
              <Link
                key={item.id}
                href={subHref}
                className={`block truncate rounded-md px-2 py-1 text-xs ${
                  subActive
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
          {items.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
