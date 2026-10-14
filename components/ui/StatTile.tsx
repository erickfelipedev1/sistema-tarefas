import type { ReactNode } from "react";

type Tone = "brand" | "warning" | "danger" | "success";

const toneStyles: Record<Tone, string> = {
  brand: "bg-brand-light text-brand-forte",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  success: "bg-success-light text-success",
};

export function StatTile({
  icon,
  value,
  label,
  tone = "brand",
  onClick,
  ativo = false,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  tone?: Tone;
  // Com "onClick" o cartão vira um botão (filtro): "ativo" marca o que está
  // valendo e clicar de novo desliga.
  onClick?: () => void;
  ativo?: boolean;
}) {
  const conteudo = (
    <>
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
      >
        {icon}
      </span>
      <div className="text-left">
        <p className="text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="mt-1.5 text-xs text-ink-muted">{label}</p>
      </div>
    </>
  );
  if (!onClick) {
    return (
      <div data-mov="card" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        {conteudo}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-mov="card"
      onClick={onClick}
      aria-pressed={ativo}
      title={ativo ? "Clique para mostrar tudo de novo" : `Mostrar só: ${label.toLowerCase()}`}
      className={`flex w-full items-center gap-3 rounded-xl border bg-surface px-4 py-3.5 transition-colors hover:bg-surface-hover ${
        ativo ? "border-brand-forte ring-2 ring-brand/30" : "border-line"
      }`}
    >
      {conteudo}
    </button>
  );
}
