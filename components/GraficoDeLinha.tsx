"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatarValor, type Formato, type GraficoDoCanal } from "@/lib/analytics";
import { caminhoSuave } from "./analytics/curva";

const MARGEM = { cima: 14, direita: 16, baixo: 28, esquerda: 54 };

function diaCurto(dia: string) {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

// Valor de eixo, compacto: 1.200 → "1,2 mil"; moeda sem centavos.
function compacto(valor: number, formato: Formato) {
  if (formato === "duracao" || formato === "percentual") return formatarValor(valor, formato);
  const texto = valor.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  return formato === "moeda" ? `R$ ${texto}` : texto;
}

// Passo "redondo" de eixo: 1, 2, 2,5 ou 5 vezes uma potência de dez.
function passoRedondo(bruto: number) {
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const fracao = bruto / potencia;
  return (fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 2.5 ? 2.5 : fracao <= 5 ? 5 : 10) * potencia;
}

// Limites e marcas do eixo. Volume: do zero até um topo redondo logo acima do
// maior valor. Nível: uma faixa redonda justa em volta dos dados (374 a 378).
// Série de números inteiros (cliques, conversas) só ganha marca inteira.
function eixo(valores: number[], nivel: boolean, intervalos: number) {
  const maior = Math.max(...valores);
  const menor = nivel ? Math.min(...valores) : 0;
  const inteiros = valores.every(Number.isInteger);
  if (maior - menor <= 0) {
    // Linha reta: uma folga em volta do valor, pra ela não colar na borda.
    const folga = inteiros ? 1 : Math.abs(maior) * 0.1 || 1;
    const piso = Math.max(0, maior - folga);
    return { piso, topo: maior + folga, marcas: piso === maior ? [piso, maior + folga] : [piso, maior, maior + folga] };
  }
  let passo = passoRedondo((maior - menor) / intervalos);
  if (inteiros) passo = Math.max(1, Math.ceil(passo));
  const piso = nivel ? Math.max(0, Math.floor(menor / passo) * passo) : 0;
  const quantos = Math.max(1, Math.ceil((maior - piso) / passo - 1e-9));
  const marcas = Array.from({ length: quantos + 1 }, (_, i) => Number((piso + i * passo).toPrecision(12)));
  return { piso, topo: marcas[marcas.length - 1], marcas };
}

// Gráfico de linha de uma série só (a evolução diária de uma métrica), em
// SVG puro. Quem usa diz o que é a linha (o seletor do "Performance"), então
// não tem legenda. Passar o mouse (ou focar e usar as setas) mostra o valor
// do dia; a tabela embaixo traz os mesmos números em texto.
// - Métricas de volume (investimento, cliques) partem do zero, com a área
//   preenchida num degradê leve; as de nível (seguidores) usam a escala
//   ajustada aos dados, senão a linha vira uma reta no topo.
// - A linha é suave mas passa exatamente por cada dia (ver curva.ts).
// - A cor é --viz-serie; os textos usam as cores de texto, nunca a da série.
export default function GraficoDeLinha({ grafico, altura = 300 }: { grafico: GraficoDoCanal; altura?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const degrade = `degrade-${useId().replace(/:/g, "")}`;
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const { pontos, formato, nivel, rotulo } = grafico;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, Math.round(el.clientWidth)));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Trocar de métrica não deixa o destaque num dia que a nova série não tem.
  useEffect(() => setAtivo(null), [grafico.chave]);

  const { piso, topo, marcas } = eixo(
    pontos.map((p) => p.valor),
    nivel,
    altura >= 240 ? 4 : 2
  );
  const faixa = topo - piso || 1;
  const areaL = largura - MARGEM.esquerda - MARGEM.direita;
  const areaA = altura - MARGEM.cima - MARGEM.baixo;
  const ultimo = pontos.length - 1;
  const x = (i: number) => MARGEM.esquerda + (ultimo === 0 ? areaL / 2 : (i / ultimo) * areaL);
  const y = (v: number) => MARGEM.cima + areaA - ((v - piso) / faixa) * areaA;
  const base = MARGEM.cima + areaA;

  const linha = caminhoSuave(pontos.map((p, i) => [x(i), y(p.valor)]));
  const area = `${linha} L${x(ultimo).toFixed(2)},${base} L${x(0).toFixed(2)},${base} Z`;
  // Datas no eixo: cinco quando cabe, três no celular.
  const quantasDatas = Math.min(pontos.length, largura >= 520 ? 5 : 3);
  const marcasX = Array.from(
    new Set(Array.from({ length: quantasDatas }, (_, i) => Math.round((i * ultimo) / Math.max(1, quantasDatas - 1))))
  );
  const emFoco = ativo !== null && ativo <= ultimo ? ativo : null;
  const destaque = emFoco ?? ultimo;

  function acharIndice(clientX: number, alvo: SVGElement) {
    const caixaSvg = alvo.getBoundingClientRect();
    const posicao = clientX - caixaSvg.left - MARGEM.esquerda;
    return Math.min(ultimo, Math.max(0, Math.round((posicao / areaL) * ultimo)));
  }

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{rotulo}</figcaption>
      <div
        ref={caixa}
        className="relative rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        tabIndex={0}
        role="group"
        aria-label={`${rotulo}: ${pontos.length} dias. Use as setas pra percorrer os valores.`}
        onFocus={() => setAtivo((atual) => atual ?? ultimo)}
        onBlur={() => setAtivo(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setAtivo((atual) => Math.min(ultimo, Math.max(0, (atual ?? ultimo) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={rotulo}
          className="block touch-pan-y"
          onPointerMove={(e) => setAtivo(acharIndice(e.clientX, e.currentTarget))}
          onPointerLeave={() => setAtivo(null)}
        >
          <defs>
            <linearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--viz-serie)" stopOpacity={0.3} />
              <stop offset="1" stopColor="var(--viz-serie)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {marcas.map((g) => (
            <g key={g}>
              <line
                x1={MARGEM.esquerda}
                x2={largura - MARGEM.direita}
                y1={y(g)}
                y2={y(g)}
                stroke="rgb(var(--color-line))"
                strokeOpacity={0.7}
                strokeWidth={1}
              />
              <text
                x={MARGEM.esquerda - 10}
                y={y(g) + 3.5}
                textAnchor="end"
                className="fill-ink-muted text-[11px] tabular-nums"
              >
                {compacto(g, formato)}
              </text>
            </g>
          ))}

          {!nivel && ultimo > 0 && <path d={area} fill={`url(#${degrade})`} />}
          {ultimo > 0 && (
            <path
              d={linha}
              fill="none"
              stroke="var(--viz-serie)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="grafico-brilho"
            />
          )}

          {emFoco !== null && (
            <line
              x1={x(emFoco)}
              x2={x(emFoco)}
              y1={MARGEM.cima}
              y2={base}
              stroke="rgb(var(--color-ink-muted))"
              strokeOpacity={0.6}
              strokeWidth={1}
            />
          )}
          {/* Ponto do dia em foco (ou o último): anel na cor do fundo pra não
              se confundir com a linha. */}
          <circle
            cx={x(destaque)}
            cy={y(pontos[destaque].valor)}
            r={4.5}
            fill="var(--viz-serie)"
            stroke="rgb(var(--color-surface))"
            strokeWidth={2}
          />

          {marcasX.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={altura - 8}
              textAnchor={i === 0 ? "start" : i === ultimo ? "end" : "middle"}
              className="fill-ink-muted text-[11px] tabular-nums"
            >
              {diaCurto(pontos[i].dia)}
            </text>
          ))}
        </svg>

        {emFoco !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-dropdown backdrop-blur"
            style={x(emFoco) > largura / 2 ? { right: largura - x(emFoco) + 12 } : { left: x(emFoco) + 12 }}
          >
            <span className="block text-[11px] tabular-nums text-ink-muted">{diaCurto(pontos[emFoco].dia)}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--viz-serie)" }} />
              {formatarValor(pontos[emFoco].valor, formato)}
            </span>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-ink-muted">
        <summary className="inline cursor-pointer hover:text-ink">Ver em tabela</summary>
        <div className="scrollbar-thin mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-1 font-medium">Dia</th>
                <th className="py-1 text-right font-medium">{rotulo}</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.dia} className="border-t border-line">
                  <td className="py-1 tabular-nums">{diaCurto(p.dia)}</td>
                  <td className="py-1 text-right tabular-nums text-ink">{formatarValor(p.valor, formato)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
