import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "@/components/ProfileEditor";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <main className="mx-auto max-w-2xl px-6 py-8">
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
