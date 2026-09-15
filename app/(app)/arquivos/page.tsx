import { createClient } from "@/lib/supabase/server";
import ArquivosDashboard from "@/components/ArquivosDashboard";
import type { ArquivoComContexto } from "@/lib/files";

export default async function ArquivosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email ??
    "";

  // Números dos dois cards ("Meus arquivos" x "Compartilhados") — busca só
  // as colunas leves (sem o caminho do arquivo) pra somar contagem e
  // tamanho. A RLS já filtra pra só vir o que essa pessoa pode ver.
  const { data: statsFiles } = await supabase
    .from("drive_files")
    .select("file_size, owner_id, client_id");

  let statMeus = { count: 0, bytes: 0 };
  let statCompartilhados = { count: 0, bytes: 0 };
  for (const f of statsFiles ?? []) {
    if (f.owner_id === user?.id) {
      statMeus = {
        count: statMeus.count + 1,
        bytes: statMeus.bytes + (f.file_size ?? 0),
      };
    } else if (!f.owner_id && !f.client_id) {
      statCompartilhados = {
        count: statCompartilhados.count + 1,
        bytes: statCompartilhados.bytes + (f.file_size ?? 0),
      };
    }
  }

  // Lista combinada de arquivos recentes (Meus arquivos + Compartilhados +
  // todos os clientes), já com o nome do cliente junto — é o que alimenta
  // "Recentemente acessados" e os filtros.
  const { data: arquivosRaw } = await supabase
    .from("drive_files")
    .select(
      "id, file_name, file_path, file_size, owner_id, client_id, uploaded_by_label, created_at, client:clients(name)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const recentes: ArquivoComContexto[] = (arquivosRaw ?? []).map((f) => ({
    id: f.id,
    file_name: f.file_name,
    file_path: f.file_path,
    file_size: f.file_size,
    owner_id: f.owner_id,
    client_id: f.client_id,
    client_name: (f.client as unknown as { name: string } | null)?.name ?? null,
    uploaded_by_label: f.uploaded_by_label,
    created_at: f.created_at,
  }));

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <ArquivosDashboard
        currentUserId={user?.id ?? ""}
        currentUserLabel={userLabel}
        cardMeus={statMeus}
        cardCompartilhados={statCompartilhados}
        totalArquivos={(statsFiles ?? []).length}
        initialRecentes={recentes}
        clients={clients ?? []}
      />
    </main>
  );
}
