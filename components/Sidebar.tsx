"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { useNotifications } from "@/lib/notifications";

const ITEMS = [
  { href: "/board", label: "Tarefas" },
  { href: "/calendario", label: "Calendário" },
  { href: "/wiki", label: "Wiki" },
  { href: "/chat", label: "Mensagens" },
];

export default function Sidebar({
  userLabel,
  userName,
  avatarUrl,
}: {
  userLabel: string;
  userName: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const {
    totalUnread,
    notificationPermission,
    requestNotificationPermission,
  } = useNotifications();

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
