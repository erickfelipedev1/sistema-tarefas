// Paleta grande de cores da Wiki (cor da página, da letra e marca-texto): uma
// linha de cinzas e 8 tons de 16 matizes, do mais claro ao mais escuro, com o
// código de cada cor (#rrggbb). Funções puras, sem rede.

const MATIZES = [0, 18, 32, 46, 58, 85, 120, 150, 170, 188, 205, 220, 240, 265, 290, 325];

// [saturação, luminosidade] de cada linha; a do meio (100, 50) é a cor "viva".
const TONS: [number, number][] = [
  [80, 93],
  [80, 85],
  [85, 75],
  [90, 64],
  [100, 50],
  [85, 40],
  [80, 30],
  [75, 20],
];

function hslParaHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

const CINZAS = Array.from({ length: MATIZES.length }, (_, i) => {
  const v = Math.round(255 - (255 * i) / (MATIZES.length - 1));
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
});

export const LINHAS_DA_PALETA: string[][] = [CINZAS, ...TONS.map(([s, l]) => MATIZES.map((h) => hslParaHex(h, s, l)))];

// "#F60", "f60", "#FF6600" → "#ff6600"; o que não for cor → null.
export function lerCodigoDeCor(texto: string): string | null {
  const t = texto.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(t)) return `#${t.split("").map((c) => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(t)) return `#${t}`;
  return null;
}

export function ehCodigoDeCor(valor: string | null | undefined): valor is string {
  return !!valor && /^#[0-9a-f]{6}$/i.test(valor);
}

// Luminância relativa (0 = preto, 1 = branco), pra decidir letra clara ou escura.
export function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
