// Regras do escritório e escala da retirada do lixo — conteúdo do
// documento "Regras Gerais" (29/09/2026). Mostrado em /regras; quem está
// na escala do dia também recebe um aviso no Painel.

export const LIXEIRAS = [
  "Lixeiras dos banheiros (Giuliano e nosso)",
  "Lixeiras da mesa",
  "Lixeira do Giuliano",
  "Lixeira da copa",
];

export const REGRAS_LIXO = [
  "Verificar as lixeiras por volta das 12h e das 18h pra retirar o lixo, todos os dias.",
  "Às 12h as lixeiras da sala podem estar razoáveis e não precisar tirar, mas é preciso verificar.",
  "Nos dias com 3 pessoas, no fim do dia, alinhem quem retira o quê: um tira o da cozinha e do banheiro, e o outro todo o resto.",
  "Alinhe com sua dupla um revezamento de horários: numa semana um pega o lixo das 12h e o outro o das 18h, e troca na semana seguinte.",
  "Quando os sacos estiverem perto de acabar, avise a Emilly.",
];

// getDay(): 1 = segunda ... 5 = sexta.
export const ESCALA_LIXO: { dia: number; rotulo: string; nomes: string[] }[] = [
  { dia: 1, rotulo: "Segunda", nomes: ["Vitoria", "Sabrina", "Nicolle"] },
  { dia: 2, rotulo: "Terça", nomes: ["Marcus", "Rodrigo"] },
  { dia: 3, rotulo: "Quarta", nomes: ["Erick", "Mariana", "Gabriel"] },
  { dia: 4, rotulo: "Quinta", nomes: ["Julia", "Guilherme"] },
  { dia: 5, rotulo: "Sexta", nomes: ["Ana", "Emilly", "Mayara"] },
];

export const REGRAS_GERAIS = [
  "Não jogue comida ou embalagens de comida nas lixeiras que ficam embaixo das mesas e no banheiro, só no lixo da cozinha.",
  "Sujou, lavou, guardou!",
  "Mantenha os ambientes em ordem: sem bolsas e materiais desnecessários nas mesas, araras arrumadas e almofadas e decorações alinhadas.",
  "Todo o escritório precisa estar em ordem pra ser um ambiente agradável e sem poluição visual.",
  "Não jogue papel higiênico no vaso sanitário, pra não entupir, e mantenha o vaso limpo.",
];

// Dia da semana de hoje no fuso de São Paulo (0 = domingo).
export function diaDaSemanaSP(agora = new Date()): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(agora);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nome);
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export type PerfilBasico = { id: string; name: string | null; username: string | null; avatar_url: string | null };

// Liga o nome da escala ("Emilly") a uma conta do sistema: pelo primeiro
// nome do perfil ou pelo começo do usuário de login ("emilly.santos").
// Se bater com mais de uma pessoa, devolve todas (a tela avisa).
export function perfisDoNome(nome: string, perfis: PerfilBasico[]): PerfilBasico[] {
  const alvo = normalizar(nome);
  return perfis.filter((p) => {
    const primeiroNome = normalizar((p.name ?? "").split(/\s+/)[0] ?? "");
    const inicioUsuario = normalizar((p.username ?? "").split(/[._-]/)[0] ?? "");
    return primeiroNome === alvo || inicioUsuario === alvo;
  });
}

// Se a pessoa está na escala de hoje, devolve quem mais está com ela.
export function escalaDeHojePara(
  perfilId: string,
  perfis: PerfilBasico[],
  agora = new Date()
): { rotulo: string; colegas: string[] } | null {
  const hoje = ESCALA_LIXO.find((e) => e.dia === diaDaSemanaSP(agora));
  if (!hoje) return null;
  const estaNaEscala = hoje.nomes.some((n) => perfisDoNome(n, perfis).some((p) => p.id === perfilId));
  if (!estaNaEscala) return null;
  const meu = perfis.find((p) => p.id === perfilId);
  const colegas = hoje.nomes.filter((n) => !perfisDoNome(n, meu ? [meu] : []).length);
  return { rotulo: hoje.rotulo, colegas };
}
