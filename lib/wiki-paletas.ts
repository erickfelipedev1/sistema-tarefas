import { ehCodigoDeCor, luminancia } from "@/lib/paleta-de-cores";

// Paletas da página da Wiki (migrations 0125 e 0126): a cor da folha, a da
// letra e o tema do editor (BlockNote) que combina — nas claras, o tema claro
// (cores de letra e marca-texto feitas pra fundo claro); nas escuras, o escuro.
// Além das prontas, qualquer cor da paleta grande (#rrggbb): o tema sai da
// luminância. A lista de códigos tem de bater com o check de pages.cor_fundo
// (0126). Funções puras, sem rede.

export interface PaletaDaPagina {
  codigo: string;
  nome: string;
  fundo: string;
  texto: string;
  tema: "light" | "dark";
}

export const PALETAS_CLARAS: PaletaDaPagina[] = [
  { codigo: "branco", nome: "Branco", fundo: "#ffffff", texto: "#2b2b2b", tema: "light" },
  { codigo: "bege", nome: "Bege", fundo: "#f3ead6", texto: "#3b3226", tema: "light" },
  { codigo: "cinza", nome: "Cinza", fundo: "#eceff1", texto: "#263238", tema: "light" },
  { codigo: "amarelo", nome: "Amarelo", fundo: "#fff6cc", texto: "#3d3300", tema: "light" },
  { codigo: "pessego", nome: "Pêssego", fundo: "#ffe6d5", texto: "#4a2a17", tema: "light" },
  { codigo: "rosa", nome: "Rosa", fundo: "#fde4ec", texto: "#4a1f2e", tema: "light" },
  { codigo: "lilas", nome: "Lilás", fundo: "#ece6f7", texto: "#2f1f4a", tema: "light" },
  { codigo: "azul", nome: "Azul", fundo: "#e2effc", texto: "#0d2a45", tema: "light" },
  { codigo: "menta", nome: "Menta", fundo: "#def3ef", texto: "#12332f", tema: "light" },
  { codigo: "verde", nome: "Verde", fundo: "#e6f4e4", texto: "#1b3a1f", tema: "light" },
];

export const PALETAS_ESCURAS: PaletaDaPagina[] = [
  { codigo: "preto", nome: "Preto", fundo: "#000000", texto: "#e8e8e8", tema: "dark" },
  { codigo: "grafite", nome: "Grafite", fundo: "#2a2c30", texto: "#e6e6e6", tema: "dark" },
  { codigo: "azul_noite", nome: "Noite", fundo: "#0f1c2e", texto: "#dce6f2", tema: "dark" },
  { codigo: "verde_escuro", nome: "Musgo", fundo: "#10241b", texto: "#d8eadf", tema: "dark" },
  { codigo: "vinho", nome: "Vinho", fundo: "#2b1119", texto: "#f0dde2", tema: "dark" },
  { codigo: "roxo", nome: "Ameixa", fundo: "#1e1631", texto: "#e4dcf2", tema: "dark" },
  { codigo: "cafe", nome: "Café", fundo: "#2a1e16", texto: "#eadfd5", tema: "dark" },
];

// O fundo de sempre (cor_fundo null): editor escuro dentro do cartão do d.hub.
export const AMOSTRA_DO_PADRAO = "#1f1f1f";

const POR_CODIGO = new Map([...PALETAS_CLARAS, ...PALETAS_ESCURAS].map((p) => [p.codigo, p]));

// Código desconhecido (ex.: paleta que saiu da lista) cai no padrão. Cor em
// código (#rrggbb): fundo claro ganha letra escura e tema claro, e vice-versa.
export function paletaDaPagina(codigo: string | null | undefined): PaletaDaPagina | null {
  if (ehCodigoDeCor(codigo)) {
    const fundo = codigo.toLowerCase();
    const clara = luminancia(fundo) > 0.4;
    return {
      codigo: fundo,
      nome: fundo.toUpperCase(),
      fundo,
      texto: clara ? "#1f1f1f" : "#f2f2f2",
      tema: clara ? "light" : "dark",
    };
  }
  return (codigo && POR_CODIGO.get(codigo)) || null;
}
