import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DriveBrowser from "@/components/DriveBrowser";
import { ChevronLeftIcon, UserIcon } from "@/components/ui/icons";

export default async function ArquivosCompartilhadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userLabel =
    (user.user_metadata?.username as string | undefined) ?? user.email ?? "";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <Link
        href="/arquivos"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Arquivos
      </Link>
      <header className="mb-6 mt-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-light text-success">
          <UserIcon className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Compartilhados
          </h1>
          <p className="text-sm text-ink-muted">
            Todo mundo do time vê e pode adicionar arquivos.
          </p>
        </div>
      </header>

      <DriveBrowser
        projectId={null}
        currentUserId={user.id}
        currentUserLabel={userLabel}
      />
    </main>
  );
}
