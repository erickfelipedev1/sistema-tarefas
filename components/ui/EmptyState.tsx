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
      className={`flex flex-col items-center justify-center gap-1 px-3 py-5 text-center ${className}`}
    >
      {icon && <div className="mb-0.5 text-ink-muted">{icon}</div>}
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {description && (
        <p className="text-[11px] text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
