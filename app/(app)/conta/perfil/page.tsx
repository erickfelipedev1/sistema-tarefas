import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import ProfileEditor from "@/components/ProfileEditor";
import EquipeDoPerfil, { type PessoaDaEquipe } from "@/components/EquipeDoPerfil";

export default async function PerfilPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) redirect("/login");

  // "*" pra não quebrar se alguma coluna nova (cargo 0034, descricao 0090)
  // ainda não existir.
  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data: todos } = await supabase.from("profiles").select("*").order("name", { ascending: true });

  const equipe: PessoaDaEquipe[] = (todos ?? [])
    .filter((p) => p.ativo !== false)
    .map((p) => ({
      id: p.id as string,
      nome: ((p.name as string | null) || (p.username as string | null) || "Sem nome") as string,
      avatar: (p.avatar_url as string | null) ?? null,
      cargo: (p.cargo as string | null) ?? "",
      descricao: (p.descricao as string | null) ?? "",
    }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <ProfileEditor
        userId={user.id}
        username={(perfil?.username as string | null) ?? null}
        initialName={(perfil?.name as string | null) ?? ""}
        initialAvatarUrl={(perfil?.avatar_url as string | null) ?? null}
        initialCargo={(perfil?.cargo as string | null | undefined) ?? ""}
        cargoDisponivel={!!perfil && "cargo" in perfil}
        initialDescricao={(perfil?.descricao as string | null | undefined) ?? ""}
        descricaoDisponivel={!!perfil && "descricao" in perfil}
      />
      <div className="mt-4">
        <EquipeDoPerfil pessoas={equipe} podeEditar={perfil?.ve_tudo === true} />
      </div>
    </main>
  );
}
