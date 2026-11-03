// Identidade visual do PDF da fatura, uma por empresa. O tema vem do nome do
// cliente; quem não tem tema próprio usa o da now d.gital.
//
// NLG: paleta e fonte do site (azul royal #0a009b, navy #001024, azul claro só
// em detalhes finos, Montserrat) e o logo branco do site.
// JORNADA 4S e JOG CORP: cores PROVISÓRIAS medidas nas fotos de perfil do
// Instagram (@jornada4s, @jogcorp); sem os logos e as cores oficiais, o nome
// vai em texto na faixa. Para trocar: colocar o logo em lib/pdf/logos/ e
// preencher "logo" (arquivo, largura em pontos e proporção largura/altura).

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
    faixa: "#0A009B",
    tabela: "#001024",
    destaque: "#0A009B",
    sobreFaixa: "#FFFFFF",
    detalheFaixa: "#5EBCD4",
    suave: "#F1F3F7",
    linha: "#DBE0E4",
    fonteTitulo: "Montserrat",
    fonteCorpo: "Montserrat",
    logo: { arquivo: "nlg.png", largura: 120, proporcao: 500 / 142 },
  },
  jornada: {
    chave: "jornada",
    marca: "JORNADA 4S",
    faixa: "#080820",
    tabela: "#080820",
    destaque: "#C8402A",
    sobreFaixa: "#FFFFFF",
    detalheFaixa: "#E8795F",
    suave: "#F6F5F8",
    linha: "#E4E2EA",
    fonteTitulo: "Urbanist",
    fonteCorpo: "Manrope",
  },
  jog: {
    chave: "jog",
    marca: "JOG CORP",
    faixa: "#001028",
    tabela: "#001028",
    destaque: "#3E5C8F",
    sobreFaixa: "#FFFFFF",
    detalheFaixa: "#A9BCD9",
    suave: "#F2F4F9",
    linha: "#DFE4EE",
    fonteTitulo: "Urbanist",
    fonteCorpo: "Manrope",
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
