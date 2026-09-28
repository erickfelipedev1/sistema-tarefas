import { NotificationsWidget } from "./NotificationsWidget";
import type { ProjectNotification } from "@/lib/types";

// Cabeçalho do dashboard do cliente — só usa dado real (o nome do
// projeto + as notificações reais do projeto). Página 100% de leitura: não
// pede nem mostra nenhum dado que o cliente teria que preencher. Não tem
// login/identidade de cliente no sistema, então não tem avatar/menu de
// usuário aqui — só o sino de notificações, que é real.
export function OnboardingHeader({
  projectName,
  token,
  notifications,
}: {
  projectName: string;
  token: string;
  notifications: ProjectNotification[];
}) {
  return (
    <div className="mb-7 flex items-start justify-between gap-3">
      <div>
        <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {projectName}
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Acompanhe o andamento do seu projeto, documentos e faturas
          compartilhados pela equipe.
        </p>
      </div>
      <div className="flex-shrink-0 pt-1">
        <NotificationsWidget notifications={notifications} token={token} variant="bell" />
      </div>
    </div>
  );
}
