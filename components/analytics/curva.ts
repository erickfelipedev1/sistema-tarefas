// Curva suave que passa por todos os pontos sem inventar pico: interpolação
// cúbica monótona (Fritsch–Carlson). Entre dois dias a linha nunca sobe além
// do maior nem desce além do menor dos dois — então não mergulha abaixo do
// zero nem exagera um salto, coisa que uma curva "arredondada" comum faz.
export function caminhoSuave(pontos: [x: number, y: number][]) {
  const n = pontos.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(2);
  if (n < 3) return pontos.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join(" ");

  const dx: number[] = [];
  const inclinacao: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pontos[i + 1][0] - pontos[i][0] || 1);
    inclinacao.push((pontos[i + 1][1] - pontos[i][1]) / dx[i]);
  }
  // Tangente em cada ponto: zero onde a série muda de direção (pico ou vale).
  const t: number[] = [inclinacao[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(inclinacao[i - 1] * inclinacao[i] <= 0 ? 0 : (inclinacao[i - 1] + inclinacao[i]) / 2);
  }
  t.push(inclinacao[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (inclinacao[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / inclinacao[i];
    const b = t[i + 1] / inclinacao[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * inclinacao[i];
      t[i + 1] = k * b * inclinacao[i];
    }
  }

  let d = `M${f(pontos[0][0])},${f(pontos[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pontos[i];
    const [x1, y1] = pontos[i + 1];
    const terco = dx[i] / 3;
    d += ` C${f(x0 + terco)},${f(y0 + t[i] * terco)} ${f(x1 - terco)},${f(y1 - t[i + 1] * terco)} ${f(x1)},${f(y1)}`;
  }
  return d;
}
