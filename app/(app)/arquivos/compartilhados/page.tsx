import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DriveBrowser from "@/components/DriveBrowser";

export default async function ArquivosCompartilhadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email ?? "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/arquivos"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← Voltar
      </Link>
      <header className="mb-6 mt-2 flex items-center gap-2">
        <span className="text-2xl">👥</span>
        <h1 className="text-2xl font-semibold">Compartilhados</h1>
      </header>

      <DriveBrowser
        clientId={null}
        currentUserId={user.id}
        currentUserLabel={userLabel}
      />
    </main>
  );
}
