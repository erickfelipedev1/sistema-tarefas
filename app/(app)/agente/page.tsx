import { PageHeader } from "@/components/ui/PageHeader";
import { BotIcon } from "@/components/ui/icons";
import AgenteEmConstrucao from "@/components/agente/AgenteEmConstrucao";

// Menu "Agente de IA": por enquanto só a tela de "em construção".
export default function AgentePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        icon={<BotIcon className="h-8 w-8" />}
        title="Agente de IA"
        subtitle="Seu assistente dentro do d.hub."
      />
      <AgenteEmConstrucao />
    </main>
  );
}
