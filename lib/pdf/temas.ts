// Identidade visual do PDF da fatura, uma por empresa. O tema vem do nome do
// cliente; quem não tem tema próprio usa o da now d.gital.
//
// NLG: manual da marca (#1800ad, #091d34, #2b99b5, Montserrat) e logo branco.
// JOG CORP: manual da marca (#041120, #212e47, dourado #dda865, marrom
// #87623c, Poppins) e logo branco em PNG transparente.
// JORNADA 4S: sem manual; cores medidas no logo (azul #00145a, laranja
// #ec3c04) e o quadrado do perfil como logo. Se chegar o manual, trocar aqui.
// Para trocar um logo: colocar o arquivo em lib/pdf/logos/ e em public/marcas/
// (portal) e preencher "logo" (arquivo, largura em pontos, proporção
// largura/altura).

export type ChaveDoTema = "now" | "nlg" | "jornada" | "jog";

export interface TemaDaFatura {
  chave: ChaveDoTema;
  // Nome em texto na faixa, quando não há logo em imagem.
  marca: string;
  faixa: string; // fundo do cabeçalho
  tabela: string; // cabeçalho da tabela e caixa do total
  destaque: string; // rótulos e traços finos sobre fundo claro
  sobreFaixa: string; // título e número sobre a faixa
  detalheFaixa: string; // rótulos pequenos sobre a faixa e sobre a caixa do total
  suave: string; // zebra da tabela e caixa de pagamento
  linha: string;
  fonteTitulo: string;
  fonteCorpo: string;
  logo?: { arquivo: string; largura: number; proporcao: number };
  // Escreve o nome ao lado do logo (quando o logo não traz o nome).
  mostrarNome?: boolean;
}

export const TEMAS: Record<ChaveDoTema, TemaDaFatura> = {
  now: {
    chave: "now",
    marca: "now d.gital",
    faixa: "#152602",
    tabela: "#152602",
    destaque: "#9BBC40",
    sobreFaixa: "#D5EF75",
    detalheFaixa: "#D5EF75",
    suave: "#F6F8EE",
    linha: "#E3E7D8",
    fonteTitulo: "Urbanist",
    fonteCorpo: "Manrope",
  },
  nlg: {
    chave: "nlg",
    marca: "NLG",
    faixa: "#1800AD",
    tabela: "#091D34",
    destaque: "#1800AD",
    sobreFaixa: "#FFFFFF",
    detalheFaixa: "#2B99B5",
    suave: "#F4F5F9",
    linha: "#E1E4EA",
    fonteTitulo: "Montserrat",
    fonteCorpo: "Montserrat",
    logo: { arquivo: "nlg.png", largura: 120, proporcao: 500 / 142 },
  },
  jornada: {
    chave: "jornada",
    marca: "JORNADA 4S",
    faixa: "#00145A",
    tabela: "#000722",
    destaque: "#EC3C04",
    sobreFaixa: "#FFFFFF",
    detalheFaixa: "#FF7A45",
    suave: "#F4F6FB",
    linha: "#DDE2EE",
    fonteTitulo: "Urbanist",
    fonteCorpo: "Manrope",
    logo: { arquivo: "jornada.png", largura: 54, proporcao: 1 },
    mostrarNome: true,
  },
  jog: {
    chave: "jog",
    marca: "JOG CORP",
    faixa: "#041120",
    tabela: "#212E47",
    // Marrom do manual para rótulos e traços sobre fundo claro (o dourado
    // fica para a faixa escura, onde tem contraste).
    destaque: "#87623C",
    sobreFaixa: "#FAFAFA",
    detalheFaixa: "#DDA865",
    suave: "#FAF6EF",
    linha: "#E8E0D2",
    fonteTitulo: "Poppins",
    fonteCorpo: "Poppins",
    logo: { arquivo: "jog.png", largura: 130, proporcao: 320 / 110 },
  },
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Escolhe o tema pelo nome do cliente (ou da empresa, no portal do dono).
export function temaDaEmpresa(nome: string): TemaDaFatura {
  const n = semAcento(nome);
  if (n.includes("nlg")) return TEMAS.nlg;
  if (n.includes("jornada")) return TEMAS.jornada;
  if (n.includes("jog")) return TEMAS.jog;
  return TEMAS.now;
}
