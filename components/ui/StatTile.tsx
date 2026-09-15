import type { ReactNode } from "react";

type Tone = "brand" | "warning" | "danger" | "success";

const toneStyles: Record<Tone, string> = {
  brand: "bg-brand-light text-brand",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  success: "bg-success-light text-success",
};

export function StatTile({
  icon,
  value,
  label,
  tone = "brand",
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="mt-1.5 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
