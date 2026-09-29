// Medidores do topo do Painel, em SVG puro: meia-lua (eficiência), anel
// (parte de um todo) e anéis concêntricos (eficiência por categoria). As
// cores vêm dos tokens --viz-* do globals.css, validados pros dois temas;
// todo medidor tem rótulo e número visíveis, então a cor nunca é a única
// pista.

function pct(valor: number | null) {
  return valor === null ? "—" : `${Math.round(valor * 100)}%`;
}

function limitar(valor: number | null) {
  return Math.min(1, Math.max(0, valor ?? 0));
}

export function MeiaLua({ valor, cor, rotulo }: { valor: number | null; cor: string; rotulo: string }) {
  const r = 70;
  const comprimento = Math.PI * r;
  return (
    <figure className="flex flex-col items-center" aria-label={`${rotulo}: ${pct(valor)}`}>
      <svg viewBox="0 0 180 100" className="w-44" role="img">
        <title>{`${rotulo}: ${pct(valor)}`}</title>
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="rgb(var(--color-surface-hover))"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {valor !== null && valor > 0 && (
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke={cor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${limitar(valor) * comprimento} ${comprimento}`}
          />
        )}
        <text
          x="90"
          y="84"
          textAnchor="middle"
          className="fill-ink text-[28px] font-semibold"
        >
          {pct(valor)}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs font-medium text-ink-muted">{rotulo}</figcaption>
    </figure>
  );
}

export function Anel({
  valor,
  cor,
  rotulo,
  quantidade,
}: {
  valor: number | null;
  cor: string;
  rotulo: string;
  quantidade: number;
}) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const descricao = `${rotulo}: ${quantidade} (${pct(valor)})`;
  return (
    <figure className="flex flex-col items-center" aria-label={descricao}>
      <svg viewBox="0 0 76 76" className="w-[72px]" role="img">
        <title>{descricao}</title>
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgb(var(--color-surface-hover))" strokeWidth="7" />
        {valor !== null && valor > 0 && (
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={cor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${limitar(valor) * circ} ${circ}`}
            transform="rotate(-90 38 38)"
          />
        )}
        <text x="38" y="43" textAnchor="middle" className="fill-ink text-[15px] font-semibold">
          {quantidade}
        </text>
      </svg>
      <figcaption className="mt-1.5 text-center">
        <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden="true" />
          {rotulo}
        </span>
        <span className="text-[11px] text-ink-muted">{pct(valor)}</span>
      </figcaption>
    </figure>
  );
}

export function AneisConcentricos({
  aneis,
  rotuloCentro,
  valorCentro,
}: {
  aneis: { valor: number | null; cor: string; rotulo: string }[];
  rotuloCentro: string;
  valorCentro: number | null;
}) {
  const descricao = aneis.map((a) => `${a.rotulo}: ${pct(a.valor)}`).join(" · ");
  return (
    <svg viewBox="0 0 160 160" className="w-40" role="img" aria-label={descricao}>
      <title>{descricao}</title>
      {aneis.map((a, i) => {
        const r = 70 - i * 15;
        const circ = 2 * Math.PI * r;
        return (
          <g key={a.rotulo}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(var(--color-surface-hover))" strokeWidth="9" />
            {a.valor !== null && a.valor > 0 && (
              <circle
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={a.cor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${limitar(a.valor) * circ} ${circ}`}
                transform="rotate(-90 80 80)"
              />
            )}
          </g>
        );
      })}
      <text x="80" y="76" textAnchor="middle" className="fill-ink-muted text-[11px] font-medium">
        {rotuloCentro}
      </text>
      <text x="80" y="96" textAnchor="middle" className="fill-ink text-[20px] font-semibold">
        {pct(valorCentro)}
      </text>
    </svg>
  );
}
