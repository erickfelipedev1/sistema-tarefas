import { createClient } from "@/lib/supabase/server";
import ClientsList from "@/components/ClientsList";

export default async function ClientesPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Clientes</h1>
      <ClientsList initialClients={clients ?? []} />
    </main>
  );
}
