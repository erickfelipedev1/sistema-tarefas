import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DriveBrowser from "@/components/DriveBrowser";

export default async function ArquivosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Arquivos</h1>
        <Link
          href="/clientes"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Ver clientes →
        </Link>
      </header>

      <DriveBrowser clientId={null} currentUserLabel={userLabel} />
    </main>
  );
}
