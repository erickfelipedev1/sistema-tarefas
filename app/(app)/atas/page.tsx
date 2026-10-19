import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import Coreografia from "@/components/movimento/Coreografia";
import AtasManager from "@/components/atas/AtasManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersIcon } from "@/components/ui/icons";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Atas · d.hub" };
// A transcrição e o rascunho com IA rodam em Server Actions desta página: a IA
// pode levar mais de um minuto numa reunião longa.
export const maxDuration = 300;

// Atas de reunião de todos os clientes (e as internas). Cada cliente também tem
// a aba "Atas" com só as dele.
export default async function AtasPage() {
  const supabase = await clienteDaRequisicao();
  const [user, perfil, { data: clientes }, { data: profiles }] = await Promise.all([
    usuarioAtual(),
    perfilAtual(),
    supabase.from("projects").select("id, name").order("name", { ascending: true }),
    supabase.from("profiles").select("id, username, name, avatar_url").order("name", { ascending: true }),
  ]);
  const userLabel =
    (user?.user_metadata?.username as string | undefined) ?? user?.email?.split("@")[0] ?? "";

  return (
    <Coreografia>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Atas"
          subtitle="Grave a reunião: a transcrição sai ao vivo, e a ata fica guardada por cliente. Uso interno: o cliente não vê."
          icon={<UsersIcon className="h-6 w-6" />}
        />
        <div data-mov="card">
          <AtasManager
            clientes={clientes ?? []}
            profiles={(profiles ?? []) as Profile[]}
            currentUserId={user?.id ?? ""}
            currentUserLabel={userLabel}
            souLider={perfil?.ve_tudo === true}
            transcricaoPaga={!!process.env.ASSEMBLYAI_API_KEY}
            iaLigada={!!process.env.ANTHROPIC_API_KEY}
          />
        </div>
      </main>
    </Coreografia>
  );
}
