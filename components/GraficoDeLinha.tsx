"use client";

import { useEffect, useRef, useState } from "react";
import { formatarValor, type Formato, type GraficoDoCanal } from "@/lib/analytics";

const ALTURA = 150;
const MARGEM = { cima: 10, direita: 14, baixo: 22, esquerda: 46 };

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

// Menor número "redondo" que é maior ou igual ao valor: 1, 1,2, 1,5, 2, 2,5,
// 3, 4, 5, 6 ou 8 vezes uma potência de dez.
function redondoAcima(valor: number) {
  if (valor <= 0) return 0;
  const potencia = Math.pow(10, Math.floor(Math.log10(valor)));
  const fracao = valor / potencia;
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((p) => p >= fracao - 1e-9) ?? 10) * potencia;
}

// Limites do eixo. Volume: do zero até um topo redondo logo acima do maior
// valor. Nível: uma faixa redonda justa em volta dos dados (ex.: 374 a 378),
// com o meio caindo num número inteiro.
function limites(valores: number[], nivel: boolean) {
  const maior = Math.max(...valores);
  const menor = Math.min(...valores);
  if (!nivel) return { piso: 0, topo: redondoAcima(maior) || 1 };
  // Passo inteiro quando os valores são pequenos (seguidores não têm meio).
  const bruto = redondoAcima((maior - menor) / 2) || 1;
  const passo = bruto < 10 ? Math.ceil(bruto) : bruto;
  const piso = Math.max(0, Math.floor(menor / passo) * passo);
  let topo = Math.ceil(maior / passo) * passo;
  if (topo === piso) topo = piso + 2 * passo;
  // Número par de passos, pra linha do meio cair num valor redondo.
  if (Math.round((topo - piso) / passo) % 2 === 1) topo += passo;
  return { piso, topo };
}

// Gráfico de linha de uma série só (a evolução diária de uma métrica), em
// SVG puro. O título diz o que é a linha, então não tem legenda. Passar o
// mouse (ou focar e usar as setas) mostra o valor do dia; a tabela embaixo
// traz os mesmos números em texto.
// - Métricas de volume (investimento, cliques) partem do zero, com a área
//   preenchida de leve; as de nível (seguidores) usam a escala ajustada aos
//   dados, senão a linha vira uma reta no topo.
// - A cor da linha é --viz-serie, validada nos dois temas; os textos usam as
//   cores de texto, nunca a da série.
export default function GraficoDeLinha({ grafico }: { grafico: GraficoDoCanal }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(320);
  const [ativo, setAtivo] = useState<number | null>(null);
  const { pontos, formato, nivel, rotulo } = grafico;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(220, Math.round(el.clientWidth)));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const { piso, topo } = limites(
    pontos.map((p) => p.valor),
    nivel
  );
  const faixa = topo - piso || 1;
  const areaL = largura - MARGEM.esquerda - MARGEM.direita;
  const areaA = ALTURA - MARGEM.cima - MARGEM.baixo;
  const x = (i: number) => MARGEM.esquerda + (pontos.length === 1 ? areaL / 2 : (i / (pontos.length - 1)) * areaL);
  const y = (v: number) => MARGEM.cima + areaA - ((v - piso) / faixa) * areaA;
  const base = MARGEM.cima + areaA;

  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const grades = [piso, piso + faixa / 2, topo];
  const marcasX = Array.from(new Set([0, Math.floor((pontos.length - 1) / 2), pontos.length - 1]));
  const ultimo = pontos.length - 1;
  const destaque = ativo ?? ultimo;

  function acharIndice(clientX: number, alvo: SVGElement) {
    const caixaSvg = alvo.getBoundingClientRect();
    const posicao = clientX - caixaSvg.left - MARGEM.esquerda;
    return Math.min(ultimo, Math.max(0, Math.round((posicao / areaL) * ultimo)));
  }

  return (
    <figure className="min-w-0">
      <figcaption className="text-xs font-medium text-ink">{rotulo}</figcaption>
      <div
        ref={caixa}
        className="relative mt-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
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
          height={ALTURA}
          role="img"
          aria-label={`${rotulo} por dia`}
          className="block touch-none"
          onPointerMove={(e) => setAtivo(acharIndice(e.clientX, e.currentTarget))}
          onPointerLeave={() => setAtivo(null)}
        >
          {grades.map((g, i) => (
            <g key={i}>
              <line
                x1={MARGEM.esquerda}
                x2={largura - MARGEM.direita}
                y1={y(g)}
                y2={y(g)}
                stroke="rgb(var(--color-line))"
                strokeWidth={1}
              />
              <text
                x={MARGEM.esquerda - 6}
                y={y(g) + 3}
                textAnchor="end"
                className="fill-ink-muted text-[10px] tabular-nums"
              >
                {compacto(g, formato)}
              </text>
            </g>
          ))}

          {!nivel && pontos.length > 1 && <path d={area} fill="var(--viz-serie)" opacity={0.1} />}
          {pontos.length > 1 && (
            <path
              d={linha}
              fill="none"
              stroke="var(--viz-serie)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {ativo !== null && (
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={MARGEM.cima}
              y2={base}
              stroke="rgb(var(--color-ink-muted))"
              strokeWidth={1}
            />
          )}
          {/* Ponto do dia em foco (ou o último): anel na cor do fundo pra não
              se confundir com a linha. */}
          <circle
            cx={x(destaque)}
            cy={y(pontos[destaque].valor)}
            r={4}
            fill="var(--viz-serie)"
            stroke="rgb(var(--color-surface))"
            strokeWidth={2}
          />

          {marcasX.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={ALTURA - 6}
              textAnchor={i === 0 ? "start" : i === ultimo ? "end" : "middle"}
              className="fill-ink-muted text-[10px] tabular-nums"
            >
              {diaCurto(pontos[i].dia)}
            </text>
          ))}
        </svg>

        {ativo !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-dropdown"
            style={
              x(ativo) > largura / 2 ? { right: largura - x(ativo) + 10 } : { left: x(ativo) + 10 }
            }
          >
            <span className="block font-semibold text-ink">{formatarValor(pontos[ativo].valor, formato)}</span>
            <span className="block text-ink-muted">{diaCurto(pontos[ativo].dia)}</span>
          </div>
        )}
      </div>

      <details className="mt-1 text-xs text-ink-muted">
        <summary className="cursor-pointer hover:text-ink">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
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
      </details>
    </figure>
  );
}
