import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import PersonalAiTokens from "@/components/PersonalAiTokens";
import type { PersonalApiToken } from "@/lib/types";

export default async function IntegracaoIaPage() {
  const supabase = await clienteDaRequisicao();
  const user = await usuarioAtual();

  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("personal_api_tokens")
    .select("id, token_prefix, label, created_at, last_used_at, revoked_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl animate-entrar px-4 py-6 sm:px-6 sm:py-8">
      <PersonalAiTokens initialTokens={(tokens as PersonalApiToken[]) ?? []} />
    </main>
  );
}
