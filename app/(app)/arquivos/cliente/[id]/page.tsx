import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DriveBrowser from "@/components/DriveBrowser";

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
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/clientes"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← Voltar para Clientes
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">{client.name}</h1>

      <DriveBrowser
        clientId={id}
        currentUserId={user.id}
        currentUserLabel={userLabel}
      />
    </main>
  );
}
