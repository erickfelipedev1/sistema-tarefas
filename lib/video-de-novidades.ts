// Vídeo de novidades do d.hub. Aparece numa janela uma vez por pessoa (a marca
// fica em avisos_vistos, migration 0134) até a data "ate"; depois disso, e
// pra rever, fica no topo de Atualizações. Pra um vídeo novo: troque o id
// (código novo = todo mundo vê de novo), os arquivos em public/novidades/ e
// o período.
export const VIDEO_DE_NOVIDADES = {
  id: "novidades-2026-11-27",
  titulo: "Novidades da semana",
  periodo: "23 a 27 de novembro",
  src: "/novidades/novidades-2026-11-27.mp4",
  capa: "/novidades/novidades-2026-11-27.jpg",
  // Último dia (fuso de Brasília) em que a janela ainda abre sozinha.
  ate: "2026-12-11",
} as const;

export function videoDeNovidadesNoAr(agora = new Date()): boolean {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return hoje <= VIDEO_DE_NOVIDADES.ate;
}
