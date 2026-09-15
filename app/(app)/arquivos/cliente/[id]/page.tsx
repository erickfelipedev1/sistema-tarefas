import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DriveBrowser from "@/components/DriveBrowser";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function ArquivosClientePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const userLabel =
    (user.user_metadata?.username as string | undefined) ??
    user.email ??
    "";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <Link
        href="/arquivos"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Arquivos
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {client.name}
      </h1>

      <DriveBrowser
        clientId={id}
        currentUserId={user.id}
        currentUserLabel={userLabel}
      />
    </main>
  );
}
