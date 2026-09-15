"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import { MenuIcon, XIcon } from "./ui/icons";
import type { Client, Project } from "@/lib/types";

// Envolve a Sidebar numa casca responsiva: no desktop ela fica fixa como
// sempre foi; em telas menores vira um menu/drawer que abre por cima do
// conteúdo, com uma barrinha superior pra abrir/fechar.
export default function AppShell({
  children,
  currentUserId,
  verTudo = false,
  userLabel,
  userName,
  avatarUrl,
  initialProjects,
  initialClients,
}: {
  children: React.ReactNode;
  currentUserId: string;
  verTudo?: boolean;
  userLabel: string;
  userName: string | null;
  avatarUrl: string | null;
  initialProjects: Project[];
  initialClients: Client[];
}) {
  const [aberto, setAberto] = useState(false);

  const sidebarProps = {
    currentUserId,
    verTudo,
    userLabel,
    userName,
    avatarUrl,
    initialProjects,
    initialClients,
  };

  return (
    <div className="flex min-h-screen">
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-ink-muted hover:bg-slate-100"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-ink">Now Organiza</span>
      </div>

      <div className="hidden lg:block">
        <Sidebar {...sidebarProps} />
      </div>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/40"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <div className="relative h-full">
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <XIcon className="h-4 w-4" />
              </button>
              <Sidebar {...sidebarProps} onNavigate={() => setAberto(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen flex-1 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
