"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon } from "./ui/icons";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Sair"
      aria-label="Sair"
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <LogOutIcon className="h-4 w-4" />
    </button>
  );
}
