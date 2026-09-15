import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-8 text-center ${className}`}
    >
      {icon && <div className="mb-1 text-ink-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-xs text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
