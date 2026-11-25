// Época de Natal do d.hub: gorro e neve no logo (components/ui/GorroDeNatal.tsx)
// e ícones de Natal (app/manifest.ts e o favicon em app/layout.tsx).
// Horário de Brasília, igual no servidor e no navegador, pra não trocar o
// desenho na hidratação: de 15/11 a 06/01 (Dia de Reis). Depois volta sozinho.
export function ehEpocaDeNatal(agora: Date = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(agora);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  const dia = Number(partes.find((p) => p.type === "day")?.value);
  return mes === 12 || (mes === 11 && dia >= 15) || (mes === 1 && dia <= 6);
}
