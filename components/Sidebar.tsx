"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import BotaoAtualizar from "./BotaoAtualizar";
import { Avatar } from "./ui/Avatar";
import { Logo } from "./ui/Logo";
import { ehIphoneForaDoApp } from "@/lib/push-client";
import { testarPush } from "@/lib/actions/push";
import {
  BarChartIcon,
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderIcon,
  ListChecksIcon,
  MessageCircleIcon,
  MoonIcon,
  SendIcon,
  SparklesIcon,
  UserIcon,
  SunIcon,
} from "./ui/icons";
import { useNotifications } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";

const SECOES: {
  titulo: string | null;
  itens: { href: string; label: string; icon: (props: { className?: string }) => JSX.Element }[];
}[] = [
  {
    titulo: null,
    itens: [
      { href: "/painel", label: "Painel", icon: BarChartIcon },
      { href: "/relatorio", label: "Relatório", icon: FileTextIcon },
      { href: "/board", label: "Tarefas", icon: ClipboardListIcon },
      { href: "/calendario", label: "Calendário", icon: CalendarIcon },
      { href: "/wiki", label: "Wiki", icon: BookOpenIcon },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      // Arquivos não tem mais tela própria — cada projeto tem sua aba
      // "Arquivos" (ver ProjectTabs), então não tem link avulso aqui.
      { href: "/projetos", label: "Clientes", icon: FolderIcon },
    ],
  },
  {
    titulo: "Comunicação",
    itens: [
      { href: "/solicitacoes", label: "Solicitações", icon: SendIcon },
      { href: "/chat", label: "Mensagens", icon: MessageCircleIcon },
      { href: "/regras", label: "Regras", icon: ListChecksIcon },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { href: "/conta/perfil", label: "Meu perfil", icon: UserIcon },
      { href: "/conta/ia", label: "Integração com IA", icon: SparklesIcon },
    ],
  },
];

export default function Sidebar({
  currentUserId,
  verTudo = false,
  userLabel,
  userCargo,
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
  userCargo: string | null;
  userName: string | null;
  avatarUrl: string | null;
  initialProjects: Project[];
  // Chamado ao clicar em qualquer link — usado pra fechar o menu/drawer no
  // celular depois de navegar. No desktop (sidebar fixa) não é passado.
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const { totalUnread, notificationPermission, requestNotificationPermission, pushAtivo } =
    useNotifications();
  // Botão "Instalar o app" (Chrome/Android/Edge avisam quando dá pra instalar).
  const [pedidoInstalacao, setPedidoInstalacao] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  useEffect(() => {
    function aoPoderInstalar(e: Event) {
      e.preventDefault();
      setPedidoInstalacao(e);
    }
    function aoInstalar() {
      setPedidoInstalacao(null);
    }
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);
  const [iphoneForaDoApp, setIphoneForaDoApp] = useState(false);
  useEffect(() => setIphoneForaDoApp(ehIphoneForaDoApp()), []);
  const [testando, setTestando] = useState(false);
  const podeAtivarPush =
    pushAtivo === false && notificationPermission !== "denied" && notificationPermission !== "unsupported";
  const { theme, toggleTheme } = useTheme();

  const [projects, setProjects] = useState<Project[]>(initialProjects);

  // Mantém a lista de projetos do menu sincronizada em tempo real (por
  // exemplo, quando um projeto novo é criado na tela de Projetos).
  // No celular existem duas Sidebars ao mesmo tempo (a fixa, escondida, e a
  // do menu aberto) — cada uma precisa do próprio canal, senão o Supabase
  // devolve o canal já inscrito e o .on() quebra a tela.
  const idCanal = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`sidebar-projects-realtime-${idCanal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          setProjects((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Project;
              // Menu individual: só entra na hora se o projeto for meu ou
              // for público — se eu ganhar uma tarefa num projeto privado
              // de outra pessoa, ele só aparece aqui no próximo
              // carregamento da página.
              if (!verTudo && !novo.is_public && novo.created_by !== currentUserId) {
                return current;
              }
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
              if (!jaEstava) {
                // Não estava na lista — só entra agora se acabou de virar
                // público (ou eu tenho "ve_tudo"/sou o dono).
                if (
                  !verTudo &&
                  !atualizado.is_public &&
                  atualizado.created_by !== currentUserId
                ) {
                  return current;
                }
                return [...current, atualizado].sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
              }
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
  }, [currentUserId, verTudo, idCanal]);

  return (
    <aside className="flex h-full min-h-screen w-64 flex-shrink-0 flex-col bg-navy text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo tamanho="md" />
        {/* No celular o menu abre como gaveta, com o "X" de fechar neste
            canto: lá o botão de atualizar fica na barra de cima (AppShell). */}
        {!onNavigate && <BotaoAtualizar className="ml-auto text-slate-400 hover:bg-white/5 hover:text-white" />}
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
                      label="Clientes"
                      icon={Icon}
                      active={active}
                      items={projects}
                      itemHref={(id) => `/projetos/${id}`}
                      emptyLabel="Nenhum cliente ainda."
                      defaultOpen={pathname.startsWith("/projetos")}
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

      {(pedidoInstalacao || iphoneForaDoApp || podeAtivarPush || pushAtivo === true) && (
        <div className="space-y-1.5 px-3 pb-2">
          {pedidoInstalacao && (
            <button
              onClick={async () => {
                await pedidoInstalacao.prompt?.();
                setPedidoInstalacao(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <span aria-hidden="true">📲</span>
              Instalar o app
            </button>
          )}
          {podeAtivarPush && (
              <button
                onClick={requestNotificationPermission}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <BellIcon className="h-3.5 w-3.5 flex-shrink-0" />
                Ativar notificações
              </button>
            )}
          {iphoneForaDoApp && (
            <p className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
              📲 Pra receber notificações no iPhone: Compartilhar → <b>Adicionar à Tela de Início</b> e abra pelo ícone.
            </p>
          )}
          {pushAtivo === true && (
            <button
              disabled={testando}
              onClick={async () => {
                setTestando(true);
                try {
                  window.alert(await testarPush());
                } catch (e) {
                  window.alert(`Erro no teste: ${(e as Error)?.message ?? e}`);
                } finally {
                  setTestando(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-60"
            >
              <BellIcon className="h-3.5 w-3.5 flex-shrink-0" />
              {testando ? "Enviando teste…" : "Testar notificação"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
        <Link
          href="/conta/perfil"
          title="Meu perfil"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 -m-1 hover:bg-white/5"
        >
          {/* O menu é sempre escuro: usa o tom de avatar do tema escuro. */}
          <Avatar name={userName || userLabel} src={avatarUrl} size="md" className="!bg-[#56684A]" />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-white">
              {userName || userLabel}
            </p>
            {userCargo ? (
              <p className="truncate text-xs text-slate-400">{userCargo}</p>
            ) : (
              userName &&
              userLabel && <p className="truncate text-xs text-slate-500">{userLabel}</p>
            )}
          </div>
        </Link>
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
        >
          {theme === "dark" ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
        </button>
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
