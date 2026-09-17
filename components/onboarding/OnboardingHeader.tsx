// Cabeçalho do onboarding — só usa dado real: o nome de contato vem do
// que o próprio cliente preencheu na etapa "Informações da empresa"
// (nunca é inventado). Antes disso, a saudação fica genérica.
export function OnboardingHeader({
  projectName,
  contactName,
}: {
  projectName: string;
  contactName: string | null;
}) {
  return (
    <div className="mb-7">
      <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
        {contactName ? `Olá, ${contactName} 👋` : "Olá! 👋"}
      </p>
      <p className="mt-1 text-base font-medium text-ink-muted sm:text-lg">
        Vamos preparar o seu projeto
      </p>
      <p className="mt-1.5 text-sm text-ink-muted">
        Complete algumas etapas para deixar tudo pronto para começar.
      </p>

      <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5">
        <span className="truncate text-sm font-semibold text-ink">
          {projectName}
        </span>
        <span className="text-line" aria-hidden>
          ·
        </span>
        <span className="whitespace-nowrap text-xs text-ink-muted">
          Onboarding do projeto
        </span>
      </div>
    </div>
  );
}
