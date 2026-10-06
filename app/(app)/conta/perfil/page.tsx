import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import ProfileEditor from "@/components/ProfileEditor";

export default async function PerfilPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Cargo vem da migration 0034 — sem ela, o campo aparece desabilitado.
  const { data: comCargo, error: erroCargo } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <ProfileEditor
        userId={user.id}
        username={perfil?.username ?? null}
        initialName={perfil?.name ?? ""}
        initialAvatarUrl={perfil?.avatar_url ?? null}
        initialCargo={(comCargo?.cargo as string | null | undefined) ?? ""}
        cargoDisponivel={!erroCargo}
      />
    </main>
  );
}
