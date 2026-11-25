import { BlockNoteSchema, COLORS_DEFAULT, createStyleSpec, defaultStyleSpecs } from "@blocknote/core";
import { ehCodigoDeCor, luminancia } from "@/lib/paleta-de-cores";

// Esquema do editor da Wiki (components/PageEditor.tsx): o do BlockNote, com a
// cor da letra (textColor) e o marca-texto (backgroundColor) aceitando também
// qualquer cor em código (#rrggbb) — a paleta grande do botão de cores. Os
// nomes dos estilos são os do BlockNote, então o que já estava colorido com as
// 9 cores dele ("red", "yellow"...) continua igual (pintado pelo CSS dele, via
// data-value). Na exportação (PDF) as duas formas viram style inline.

type Tipo = "color" | "backgroundColor";

function span() {
  const el = document.createElement("span");
  return { dom: el, contentDOM: el };
}

// Cor com nome do BlockNote fica com o CSS dele; o resto (código, rgb() de
// texto colado) vai direto no style. Valor inválido o navegador ignora. O
// marca-texto em código também escolhe a letra que dá pra ler por cima (escura
// em cor clara, clara em cor escura); se a pessoa escolheu cor de letra, ela
// vale, porque o marca-texto fica por fora (ordem dos estilos no esquema).
function pintar(tipo: Tipo, valor: string | undefined) {
  const r = span();
  if (valor && valor !== "default" && !(valor in COLORS_DEFAULT)) {
    r.dom.style[tipo] = valor;
    if (tipo === "backgroundColor" && ehCodigoDeCor(valor)) {
      r.dom.style.color = luminancia(valor) > 0.4 ? "#1f1f1f" : "#f2f2f2";
    }
  }
  return r;
}

function exportar(tipo: Tipo, valor: string | undefined) {
  const r = span();
  if (valor && valor !== "default") {
    const nomeada = COLORS_DEFAULT[valor as keyof typeof COLORS_DEFAULT];
    r.dom.style[tipo] = nomeada ? (tipo === "color" ? nomeada.text : nomeada.background) : valor;
  }
  return r;
}

const corDaLetra = createStyleSpec(
  { type: "textColor", propSchema: "string" },
  {
    render: (valor) => pintar("color", valor),
    toExternalHTML: (valor) => exportar("color", valor),
    parse: (el) => (el.tagName === "SPAN" && el.style.color ? el.style.color : undefined),
  }
);

const marcaTexto = createStyleSpec(
  { type: "backgroundColor", propSchema: "string" },
  {
    render: (valor) => pintar("backgroundColor", valor),
    toExternalHTML: (valor) => exportar("backgroundColor", valor),
    parse: (el) => (el.tagName === "SPAN" && el.style.backgroundColor ? el.style.backgroundColor : undefined),
  }
);

// O marca-texto vem antes da cor da letra: o primeiro estilo fica por fora no
// HTML, então a cor de letra escolhida (por dentro) ganha da automática.
const { textColor: _letra, backgroundColor: _marca, ...outrosEstilos } = defaultStyleSpecs;
void _letra;
void _marca;

export const esquemaDaWiki = BlockNoteSchema.create({
  styleSpecs: { ...outrosEstilos, backgroundColor: marcaTexto, textColor: corDaLetra },
});

// Cor de amostra de um valor salvo (nome do BlockNote ou código).
export function corParaMostrar(valor: string | undefined, tipo: "texto" | "fundo"): string | undefined {
  if (!valor || valor === "default") return undefined;
  const nomeada = COLORS_DEFAULT[valor as keyof typeof COLORS_DEFAULT];
  if (nomeada) return tipo === "texto" ? nomeada.text : nomeada.background;
  return valor;
}
