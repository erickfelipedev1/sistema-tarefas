import { UserIcon, UsersIcon } from "../ui/icons";
import { Badge } from "../ui/Badge";
import type { ProjectTeamMember } from "@/lib/types";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// "Sua equipe" — o responsável do projeto (projects.responsible_id) +
// quem tem alguma tarefa atribuída nele. Não existe cadastro de "time do
// projeto" à parte (decisão do Erick), então é essa a fonte real.
export function ProjectTeamCard({ team }: { team: ProjectTeamMember[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Sua equipe</p>

      {team.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <UsersIcon className="h-4 w-4 flex-shrink-0" />
          A equipe responsável ainda vai ser definida.
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {team.slice(0, 4).map((pessoa) => (
            <div key={pessoa.id} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand">
                {pessoa.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pessoa.avatar_url}
                    alt={pessoa.name}
                    className="h-full w-full object-cover"
                  />
                ) : pessoa.name ? (
                  iniciais(pessoa.name)
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{pessoa.name}</p>
                <p className="text-xs text-ink-muted">
                  {pessoa.is_responsible ? "Responsável pelo projeto" : "Equipe do projeto"}
                </p>
              </div>
              {pessoa.is_responsible && <Badge tone="brand">Responsável</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
