// Lê um valor em reais digitado à brasileira: "1.500,00", "1500,5", "1500",
// "1.500" (ponto de milhar) e "R$ 500" viram número. Devolve null se não for
// um valor válido (vazio, texto, negativo).
export function lerValor(texto: string): number | null {
  let limpo = texto.replace(/[R$\s]/g, "");
  if (limpo === "") return null;
  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    limpo = limpo.replace(/\./g, "");
  }
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Lê uma quantidade: "2", "1,5" ou "1.5". Aqui ponto é sempre decimal — em
// quantidade não existe milhar ("2.500" seria 2,5, não dois mil e quinhentos).
export function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Número → texto de campo, à brasileira: 1500 → "1500,00".
export function escreverValor(n: number) {
  return n.toFixed(2).replace(".", ",");
}
