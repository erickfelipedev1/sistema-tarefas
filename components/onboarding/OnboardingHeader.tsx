// Cabeçalho do dashboard do cliente — só usa dado real (o nome do
// projeto). Página 100% de leitura: não pede nem mostra nenhum dado que
// o cliente teria que preencher.
export function OnboardingHeader({ projectName }: { projectName: string }) {
  return (
    <div className="mb-7">
      <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
        {projectName}
      </p>
      <p className="mt-1.5 text-sm text-ink-muted">
        Acompanhe o andamento do seu projeto, documentos e faturas
        compartilhados pela equipe.
      </p>
    </div>
  );
}
