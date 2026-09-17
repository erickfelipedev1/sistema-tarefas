// Card de progresso do onboarding. O texto "X de Y etapas concluídas" vem
// antes do percentual de propósito (o percentual sozinho não diz nada) —
// e a barra sempre acompanha o valor real, nunca fixo.
export function OnboardingProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Seu progresso</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {completed} de {total} etapas concluídas
          </p>
        </div>
        <span className="flex-shrink-0 text-2xl font-bold text-ink">
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do onboarding"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
