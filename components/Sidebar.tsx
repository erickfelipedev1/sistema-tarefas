"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { Avatar } from "./ui/Avatar";
import {
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileStackIcon,
  FolderIcon,
  MessageCircleIcon,
  SendIcon,
} from "./ui/icons";
import { useNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";

const SECOES: {
  titulo: string | null;
  itens: { href: string; label: string; icon: (props: { className?: string }) => JSX.Element }[];
}[] = [
  {
    titulo: null,
    itens: [
      { href: "/board", label: "Tarefas", icon: ClipboardListIcon },
      { href: "/calendario", label: "Calendário", icon: CalendarIcon },
      { href: "/wiki", label: "Wiki", icon: BookOpenIcon },
    ],
  },
  {
    titulo: "Projetos",
    itens: [
      { href: "/projetos", label: "Projetos", icon: FolderIcon },
      { href: "/arquivos", label: "Arquivos", icon: FileStackIcon },
    ],
  },
  {
    titulo: "Comunicação",
    itens: [
      { href: "/solicitacoes", label: "Solicitações", icon: SendIcon },
      { href: "/chat", label: "Mensagens", icon: MessageCircleIcon },
    ],
  },
];

export default function Sidebar({
  currentUserId,
  verTudo = false,
  userLabel,
  userName,
  avatarUrl,
  initialProjects,
  onNavigate,
}: {
  currentUserId: string;
  // Quem tem "ve_tudo" (hoje só a Emily) não filtra nada no menu — vê o
  // projeto de todo mundo assim que é criado.
  verTudo?: boolean;
  userLabel: string;
  userName: string | null;
  avatarUrl: string | null;
  initialProjects: Project[];
  // Chamado ao clicar em qualquer link — usado pra fechar o menu/drawer no
  // celular depois de navegar. No desktop (sidebar fixa) não é passado.
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const { totalUnread, notificationPermission, requestNotificationPermission } =
    useNotifications();

  const [projects, setProjects] = useState<Project[]>(initialProjects);

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
              // Menu individual: só entra na hora se o projeto for meu — se
              // eu ganhar uma tarefa num projeto de outra pessoa, ele só
              // aparece aqui no próximo carregamento da página.
              if (!verTudo && novo.created_by !== currentUserId) return current;
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
              const jaEstava = current.some((p) => p.id === atualizado.id);
              if (!jaEstava) return current;
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
  }, [currentUserId, verTudo]);

  return (
    <aside className="flex h-full min-h-screen w-64 flex-shrink-0 flex-col bg-navy text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-navy">
          N
        </span>
        <span className="text-sm font-semibold tracking-tight text-white">
          Now Organiza
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {SECOES.map((secao, i) => (
          <div key={secao.titulo ?? `secao-${i}`}>
            {secao.titulo && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {secao.titulo}
              </p>
            )}
            <div className="space-y-1">
              {secao.itens.map((item) => {
                const active = pathname.startsWith(item.href);
                const badgeCount = item.href === "/chat" ? totalUnread : 0;
                const showBadge = badgeCount > 0;
                const Icon = item.icon;

                if (item.href === "/projetos") {
                  return (
                    <ExpandableNavItem
                      key={item.href}
                      href="/projetos"
                      label="Projetos"
                      icon={Icon}
                      active={active}
                      items={projects}
                      itemHref={(id) => `/projetos/${id}`}
                      emptyLabel="Nenhum projeto ainda."
                      defaultOpen={pathname.startsWith("/projetos")}
                      onNavigate={onNavigate}
                    />
                  );
                }

                if (item.href === "/arquivos") {
                  // Os arquivos de cada cliente agora vivem dentro do
                  // projeto dele (aba "Arquivos" em /projetos/[id]) — aqui
                  // sobram só os dois atalhos fixos, sem lista de clientes.
                  return (
                    <ExpandableNavItem
                      key={item.href}
                      href="/arquivos"
                      label="Arquivos"
                      icon={Icon}
                      active={active}
                      items={[]}
                      itemHref={() => "/arquivos"}
                      defaultOpen={pathname.startsWith("/arquivos")}
                      extraLinks={[
                        { href: "/arquivos/meus", label: "🔒 Meus arquivos" },
                        { href: "/arquivos/compartilhados", label: "👥 Compartilhados" },
                      ]}
                      onNavigate={onNavigate}
                    />
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand text-navy"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {notificationPermission === "default" && (
        <div className="px-3 pb-2">
          <button
            onClick={requestNotificationPermission}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <BellIcon className="h-3.5 w-3.5 flex-shrink-0" />
            Ativar notificações de mensagem
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
        <Avatar name={userName || userLabel} src={avatarUrl} size="md" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium text-white">
            {userName || userLabel}
          </p>
          {userName && userLabel && (
            <p className="truncate text-xs text-slate-500">{userLabel}</p>
          )}
        </div>
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
  icon: Icon,
  active,
  items,
  itemHref,
  emptyLabel,
  defaultOpen,
  extraLinks,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  active: boolean;
  items: { id: string; name: string }[];
  itemHref: (id: string) => string;
  // Só usado quando "items" pode vir vazio de verdade (ex: "Projetos") —
  // quando a lista nem existe mais (ex: "Arquivos"), fica de fora e nada é
  // mostrado no lugar.
  emptyLabel?: string;
  defaultOpen: boolean;
  // Links fixos (não vêm de uma lista do banco) mostrados antes da lista,
  // ex: "Meus arquivos" / "Compartilhados" dentro de "Arquivos".
  extraLinks?: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <div>
      <div
        className={`group flex items-center gap-2.5 rounded-lg pr-1 text-sm font-medium transition-colors ${
          active ? "bg-brand text-navy" : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Link
          href={href}
          onClick={onNavigate}
          className="flex flex-1 items-center gap-2.5 py-2.5 pl-3"
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          title={aberto ? "Recolher" : "Expandir"}
          className={`rounded-md p-1.5 ${
            active ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-slate-200"
          }`}
        >
          {aberto ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {aberto && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {extraLinks?.map((link) => {
            const linkActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={`block truncate rounded-md px-2 py-1.5 text-xs ${
                  linkActive
                    ? "bg-white/10 font-medium text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {items.map((item) => {
            const subHref = itemHref(item.id);
            const subActive = pathname === subHref;
            return (
              <Link
                key={item.id}
                href={subHref}
                onClick={onNavigate}
                className={`block truncate rounded-md px-2 py-1.5 text-xs ${
                  subActive
                    ? "bg-white/10 font-medium text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
          {items.length === 0 && emptyLabel && (
            <p className="px-2 py-1.5 text-xs text-slate-500">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
