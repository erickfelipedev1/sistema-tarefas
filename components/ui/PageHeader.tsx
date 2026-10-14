import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  // Ícone ao lado do título (opcional).
  icon?: ReactNode;
}) {
  return (
    <div data-mov="topo" className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="flex-shrink-0 text-brand-forte">{icon}</span>}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
