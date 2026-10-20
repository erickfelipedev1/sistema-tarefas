import { redirect } from "next/navigation";
import { clienteDaRequisicao, usuarioAtual } from "@/lib/sessao";
import { PageHeader } from "@/components/ui/PageHeader";
import { BotIcon } from "@/components/ui/icons";
import Coreografia from "@/components/movimento/Coreografia";
import AgenteDoDhub, { type ConexaoDoAgente } from "@/components/agente/AgenteDoDhub";

export const dynamic = "force-dynamic";

// Menu "Agente de IA": como ligar o Claude da pessoa ao d.hub (servidor MCP
// em /api/mcp, login por OAuth) e se ela já está conectada (tokens pessoais
// não revogados, os mesmos de "Integração com IA").
export default async function AgentePage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = await clienteDaRequisicao();
  const { data } = await supabase
    .from("personal_api_tokens")
    .select("label, last_used_at, created_at")
    .eq("profile_id", user.id)
    .is("revoked_at", null);

  return (
    <Coreografia>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader icon={<BotIcon className="h-8 w-8" />} title="Agente de IA" subtitle="Seu assistente dentro do d.hub." />
        <AgenteDoDhub conexoes={(data ?? []) as ConexaoDoAgente[]} />
      </main>
    </Coreografia>
  );
}
